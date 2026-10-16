"""Create short-lived certificates only in this project's owned test directory."""
from datetime import datetime, timedelta, timezone
from ipaddress import ip_address
from pathlib import Path
import re
import sys

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

root = Path(__file__).resolve().parent.parent / '.scratch' / 'runtime'
directory = Path(sys.argv[1]).resolve()
if directory.parent != root.resolve() or not re.fullmatch(r'tls-fixture-[0-9a-f-]{36}', directory.name):
    raise ValueError('Refusing to create certificates outside an owned project fixture')
directory.mkdir(parents=True, exist_ok=False)
now = datetime.now(timezone.utc)


def authority(name):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, name)])
    cert = (x509.CertificateBuilder().subject_name(subject).issuer_name(subject)
            .public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now - timedelta(minutes=5)).not_valid_after(now + timedelta(days=2))
            .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
            .add_extension(x509.KeyUsage(False, False, False, False, False, True, True, False, False), critical=True)
            .sign(key, hashes.SHA256()))
    return key, cert


ca_key, ca_cert = authority('DSH Redis exclusive fixture CA')
_, wrong_ca = authority('DSH Redis unrelated fixture CA')
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
identity = ([x509.DNSName('wrong-host.fixture')] if sys.argv[2] == 'mismatch'
            else [x509.IPAddress(ip_address('127.0.0.1')), x509.DNSName('localhost')])
cert = (x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'DSH Redis fixture')]))
        .issuer_name(ca_cert.subject).public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=5)).not_valid_after(now + timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.SubjectAlternativeName(identity), critical=False)
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .sign(ca_key, hashes.SHA256()))
for name, value in [('ca.pem', ca_cert), ('wrong-ca.pem', wrong_ca), ('server.pem', cert)]:
    (directory / name).write_bytes(value.public_bytes(serialization.Encoding.PEM))
(directory / 'server.key').write_bytes(key.private_bytes(
    serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
