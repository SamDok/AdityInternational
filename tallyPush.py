import requests
import core

def send_to_tally(xml_data):
    headers = {
        'Content-Type': 'application/xml'
    }
    #try:
    response = requests.post(core.URL, data=xml_data, headers=headers)
    if response.status_code == 200:
        print("Data successfully sent to Tally")
        return response.text
    else:
        print("Connection not established")
        return None

    #except requests.exceptions.RequestException as e:
    #    print(f"Network-related error occurred: {e}")
    #    return None
    #except requests.exceptions.HTTPError as e:
    #    print(f"HTTP error occurred: {e}")
    #    return None
    #except requests.exceptions.ConnectionError as e:
    #    print(f"Error connecting to Tally: {e}")
    #    return None
    #except requests.exceptions.Timeout as e:
    #    print(f"Timeout error: {e}")
    #    return None
    #except Exception as e:
    #    print(f"An unexpected error occurred: {e}")
    #    return None
