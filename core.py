import requests

URL = 'http://192.168.0.199:9000'
access_token = '2/1201562239697862/1207795067604666:dda7b6e706d29e9d22ff3618520333b6'
project_id = '1205887908772611'
SECTION_ID = '1205887908772612'
SECTION_ID_MOVE = '1206861947290727'
column_name = 'To do OCs'

exchange_rate_api_url = "http://api.exchangeratesapi.io/v6/latest"  # Example API endpoint
exchange_rate_api_key = "914abfb6c580e5a8ae92c163"  # Replace with your actual API key

ledger_name = {"T":"Sales"}


def push_exchange_rate():
    conversion = {"USD":0,"EUR":0}
    conversion["USD"] = round(float(get_exchange_rate(exchange_rate_api_key, "USD")),2)
    conversion["EUR"] = round(float(get_exchange_rate(exchange_rate_api_key, "EUR")),2)
    return conversion


def get_exchange_rate(api_key, base_currency):
    #response = requests.get(f"{api_url}?access_key={api_key}&base={base_currency}&symbols={target_currency}")
    response = requests.get(f"https://v6.exchangerate-api.com/v6/{api_key}/latest/{base_currency}")
    data = response.json()
    return data["conversion_rates"]["INR"]

# API details


#print(push_exchange_rate())

headers = {
    'Authorization': f'Bearer {access_token}',
    'Content-Type': 'application/json'
}