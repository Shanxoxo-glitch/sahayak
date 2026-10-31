import pytest
from fastapi.testclient import TestClient
from app.main import app as fastapi_app

client = TestClient(fastapi_app)

def test_auth_full_flow():
    # 1. Signup Victim
    victim_signup_data = {
        "email": "victim_test_1@example.com",
        "password": "Password123!",
        "role": "victim",
        "name": "Ananya Sharma",
        "contact": "+919876543210",
        "vulnerability_category": "SC/ST_PoA_Sec3",
        "preferred_language": "hi"
    }
    res = client.post("/api/v1/auth/signup", json=victim_signup_data)
    assert res.status_code in (201, 409), res.text
    if res.status_code == 201:
        token_data = res.json()
        assert "access_token" in token_data
        assert token_data["role"] == "victim"
        victim_token = token_data["access_token"]
    else:
        login_res = client.post("/api/v1/auth/login", json={
            "email": "victim_test_1@example.com",
            "password": "Password123!"
        })
        assert login_res.status_code == 200, login_res.text
        victim_token = login_res.json()["access_token"]

    # 2. Login Victim
    login_res = client.post("/api/v1/auth/login", json={
        "email": "victim_test_1@example.com",
        "password": "Password123!"
    })
    assert login_res.status_code == 200, login_res.text
    assert login_res.json()["role"] == "victim"

    # 3. Get /me for Victim
    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {victim_token}"}
    )
    assert me_res.status_code == 200, me_res.text
    me_data = me_res.json()
    assert me_data["email"] == "victim_test_1@example.com"
    assert me_data["role"] == "victim"

    # 4. Signup Counselor
    counselor_signup_data = {
        "email": "counselor_test_1@example.com",
        "password": "Password123!",
        "role": "counselor",
        "name": "Dr. Rajesh Kumar",
        "specialization": "Trauma & Crisis Counseling",
        "organization": "District Legal Services Authority"
    }
    c_res = client.post("/api/v1/auth/signup", json=counselor_signup_data)
    assert c_res.status_code in (201, 409), c_res.text
    if c_res.status_code == 201:
        c_token = c_res.json()["access_token"]
    else:
        c_login = client.post("/api/v1/auth/login", json={
            "email": "counselor_test_1@example.com",
            "password": "Password123!"
        })
        c_token = c_login.json()["access_token"]

    # 5. Get /me for Counselor
    c_me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {c_token}"}
    )
    assert c_me_res.status_code == 200, c_me_res.text
    c_me_data = c_me_res.json()
    assert c_me_data["role"] == "counselor"

    # 6. Signup Admin
    admin_signup_data = {
        "email": "admin_test_1@example.com",
        "password": "Password123!",
        "role": "admin",
        "department": "State Monitoring Cell",
        "access_level": "superadmin"
    }
    a_res = client.post("/api/v1/auth/signup", json=admin_signup_data)
    assert a_res.status_code in (201, 409), a_res.text
    if a_res.status_code == 201:
        a_token = a_res.json()["access_token"]
    else:
        a_login = client.post("/api/v1/auth/login", json={
            "email": "admin_test_1@example.com",
            "password": "Password123!"
        })
        a_token = a_login.json()["access_token"]

    # 7. Get /me for Admin
    a_me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {a_token}"}
    )
    assert a_me_res.status_code == 200, a_me_res.text
    a_me_data = a_me_res.json()
    assert a_me_data["role"] == "admin"
