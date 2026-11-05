import hashlib

from api_payments import paynow_hash


def test_paynow_hash_matches_sha512_contract():
    fields = {"id": "1234", "reference": "EHD-ABC123", "amount": "100.00"}
    expected = hashlib.sha512(
        ("1234" + "EHD-ABC123" + "100.00" + "secret-key").encode()
    ).hexdigest().upper()
    assert paynow_hash(fields, "secret-key") == expected


def test_phone_normalisation():
    from auth_utils import normalise_phone, valid_phone

    assert normalise_phone("0771 234 567") == "263771234567"
    assert normalise_phone("+263 771 234 567") == "263771234567"
    assert valid_phone("0771234567")
    assert not valid_phone("123")
    assert not valid_phone("")
