"""Extract verified official image files into an owned E-drive test cache.

No image entrypoint runs during preparation. Archive paths and link targets stay
inside this cache; links to files are materialized without creating OS symlinks.
"""
import hashlib
import json
import posixpath
import shutil
import tarfile
import urllib.request
from pathlib import Path, PurePosixPath

INDEX = 'sha256:ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e'
MANIFEST = 'sha256:f4a7260ec5f053de31eccb19ba2c997f7c3ea4ace799c9479d411b84bd6f158e'
BASE = Path(__file__).resolve().parent.parent / '.scratch' / 'runtime' / 'redis-image-f4a7260ec5f0'
BASE.mkdir(parents=True, exist_ok=True)
assert BASE.resolve().parent == (Path(__file__).resolve().parent.parent / '.scratch' / 'runtime').resolve()
ROOT = BASE / 'root'
ROOT.mkdir(exist_ok=True)
assert ROOT.resolve().parent == BASE.resolve()
token = json.load(urllib.request.urlopen('https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/redis:pull', timeout=30))['token']


def fetch(kind, digest, max_bytes):
    assert len(digest) == 71 and digest.startswith('sha256:')
    path = BASE / (digest[7:] + ('.json' if kind == 'manifests' else '.blob'))
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == digest[7:]:
        return path
    request = urllib.request.Request('https://registry-1.docker.io/v2/library/redis/' + kind + '/' + digest, headers={
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json',
    })
    checksum, size = hashlib.sha256(), 0
    with urllib.request.urlopen(request, timeout=60) as response, path.open('wb') as output:
        while chunk := response.read(1024 * 1024):
            size += len(chunk)
            assert size <= max_bytes, 'Image download exceeds declared budget'
            checksum.update(chunk)
            output.write(chunk)
    assert checksum.hexdigest() == digest[7:], 'Image digest mismatch'
    return path


index = json.loads(fetch('manifests', INDEX, 1024 * 1024).read_bytes())
selected = next(item for item in index['manifests'] if item.get('platform', {}).get('os') == 'linux' and item.get('platform', {}).get('architecture') == 'amd64')
assert selected['digest'] == MANIFEST
manifest = json.loads(fetch('manifests', MANIFEST, 1024 * 1024).read_bytes())
assert sum(item['size'] for item in manifest['layers']) < 128 * 1024 * 1024
config = json.loads(fetch('blobs', manifest['config']['digest'], 1024 * 1024).read_bytes())
assert 'REDIS_VERSION=8.2.6' in config['config']['Env']
links = {}
total_bytes = 0


def target(name):
    pure = PurePosixPath(name)
    assert not pure.is_absolute() and '..' not in pure.parts and '\\' not in name
    path = ROOT.joinpath(*pure.parts)
    assert path.resolve().is_relative_to(ROOT.resolve()), 'Archive path escapes owned root'
    return path


for layer in manifest['layers']:
    blob = fetch('blobs', layer['digest'], layer['size'])
    with tarfile.open(blob, 'r:gz') as archive:
        for member in archive:
            name = member.name.rstrip('/')
            if not name or name == '.':
                continue
            # This pinned image needs no opaque/delete layers. Refuse new semantics.
            assert not any(part.startswith('.wh.') for part in PurePosixPath(name).parts)
            path = target(name)
            if member.isdir():
                path.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                assert member.size <= 128 * 1024 * 1024
                total_bytes += member.size
                assert total_bytes <= 512 * 1024 * 1024
                path.parent.mkdir(parents=True, exist_ok=True)
                source = archive.extractfile(member)
                assert source is not None
                with source, path.open('wb') as output:
                    shutil.copyfileobj(source, output, 1024 * 1024)
                links.pop(name, None)
            elif member.issym() or member.islnk():
                destination = member.linkname
                resolved = posixpath.normpath(destination.lstrip('/') if destination.startswith('/') or member.islnk() else posixpath.join(posixpath.dirname(name), destination))
                target(resolved)
                links[name] = resolved
            else:
                raise ValueError('Unexpected special image entry: ' + name)
for name, linked in links.items():
    seen = {name}
    while linked in links:
        assert linked not in seen, 'Cyclic image link'
        seen.add(linked)
        linked = links[linked]
    source = target(linked)
    if source.is_file():
        destination = target(name)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
receipt = {'imageIndex': INDEX, 'manifest': MANIFEST, 'redisVersion': '8.2.6', 'architecture': 'linux/amd64', 'layers': manifest['layers'], 'extractedBytes': total_bytes}
(BASE / 'verified-image.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'root': str(ROOT), 'imageIndex': INDEX, 'manifest': MANIFEST, 'extractedBytes': total_bytes}, ensure_ascii=True))
