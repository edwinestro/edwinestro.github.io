#!/usr/bin/env python3

"""
Simple CLI program that:
1. Asks for your OpenAI API key
2. Creates a client connection
3. Sends a test prompt

Requirements:
- Python 3.9+
- pip install openai
"""

import getpass
from openai import OpenAI


def main():
    print("=== OpenAI CLI Test Program ===")

    # Ask for API key securely
    api_key = getpass.getpass("Enter your OpenAI API key: ")

    if not api_key:
        print("API key is required")
        return

    # Create client
    client = OpenAI(api_key=api_key)

    print("\nConnected. Sending test prompt...\n")

    # Send a test request
    response = client.responses.create(
        model="gpt-4.1",
        input="Say hello and confirm the connection works."
    )

    # Print output
    print("Response from model:\n")
    print(response.output_text)


if __name__ == "__main__":
    main()
