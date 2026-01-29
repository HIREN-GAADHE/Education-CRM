import sys
import os

# Create a dummy environment to satisfy imports
os.environ["SECRET_KEY"] = "debug_secret"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"

# Add current directory to path
sys.path.append(os.getcwd())

from app.main import app

def list_routes():
    print("Listing all registered routes:")
    for route in app.routes:
        if hasattr(route, "path"):
            print(f"- {route.path} [{route.name}]")
        elif hasattr(route, "routes"):
            # Mounts
            print(f"Mount: {route.path}")

if __name__ == "__main__":
    list_routes()
