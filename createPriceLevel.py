import requests
import core
# XML data to create a new price level
xml_data = """
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>All Masters</REPORTNAME>
                    <STATICVARIABLES>
                            <SVCURRENTCOMPANY>Trial</SVCURRENTCOMPANY>
                    </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
                <TALLYMESSAGE xmlns:UDF="TallyUDF">
                    <STOCKITEM NAME="Item 1">

                    <FULLPRICELIST>
                        <PRICELEVEL Name = "Party 4">
                            <NAME.LIST>
                                <NAME>Party 4</NAME>
                            </NAME.LIST>
                        </PRICELEVEL>
                        <DATE>20240401</DATE>
                    </FULLPRICELIST>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>

"""

# Tally server URL
tally_url = core.URL

# Send the request to Tally
response = requests.post(tally_url, data=xml_data)
print(response)

# Check the response
if response.status_code == 200:
    print("Price level created successfully in Tally.")
else:
    print(f"Failed to create price level. Status code: {response.status_code}")
