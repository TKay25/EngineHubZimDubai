def test_customer_can_update_profile_details(client, customer):
    response = client.patch(
        "/api/auth/profile",
        json={"name": "Tendai Updated", "phone": "0771 765 432"},
    )

    assert response.status_code == 200
    assert response.get_json()["user"]["name"] == "Tendai Updated"
    assert response.get_json()["user"]["phone"] == "263771765432"


def test_profile_rejects_invalid_contact_details_without_saving(client, customer):
    response = client.patch(
        "/api/auth/profile",
        json={"name": "X", "phone": "123"},
    )

    assert response.status_code == 400
    profile = client.get("/api/auth/me").get_json()["user"]
    assert profile["name"] == customer["name"]
    assert profile["phone"] == customer["phone"]


def test_profile_update_requires_authentication(client):
    response = client.patch(
        "/api/auth/profile",
        json={"name": "Tendai Updated", "phone": "0771 765 432"},
    )

    assert response.status_code == 401
