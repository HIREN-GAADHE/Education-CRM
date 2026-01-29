import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_modules():
    print(f"Testing GET {BASE_URL}/roles/metadata/modules")
    try:
        response = requests.get(f"{BASE_URL}/roles/metadata/modules")
        print(f"Status Code: {response.status_code}")
        print("Response Body:")
        print(response.text)
        try:
            print(json.dumps(response.json(), indent=2))
        except:
            pass
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_modules()
