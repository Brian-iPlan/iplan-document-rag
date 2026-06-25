import os
import sys

# Try to load the key from backend/.env if not already set in the environment
if not os.getenv("GEMINI_API_KEY"):
    env_path = os.path.join("backend", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if line.strip().startswith("GEMINI_API_KEY="):
                    key = line.strip().split("=", 1)[1]
                    # Strip any surrounding quotes
                    key = key.strip('"').strip("'")
                    os.environ["GEMINI_API_KEY"] = key
                    break

api_key = os.getenv("GEMINI_API_KEY")
if not api_key or "YOUR_NEW" in api_key:
    print("Error: GEMINI_API_KEY is not set in the environment or backend/.env file.")
    print("Please make sure you have added your real API key to backend/.env.")
    sys.exit(1)

try:
    print("Initializing GenAI client...")
    from google import genai
    client = genai.Client()
    
    print("Sending test generation request using model: gemini-2.5-flash...")
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents='Hello! Please reply with "Gemini Connection Successful!" and a short 5-word joke.'
    )
    print("\n--- Response ---")
    print(response.text.strip())
    print("----------------")
    print("Connection test completed successfully!")
except ImportError:
    print("\nError: The 'google-genai' package is not installed.")
    print("Please install it using: pip install google-genai")
    sys.exit(1)
except Exception as e:
    print(f"\nError during connection test: {e}")
    sys.exit(1)
