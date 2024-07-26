import requests
import core
import ensure
import tallyPush

# Example XML data
def append_to_price_list(stockItem,ledger_name):
	xml_data = f"""
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
		                    <STOCKITEM NAME="{stockItem}">
		                        <FULLPRICELIST>
		                            <PRICELEVEL>{ledger_name}</PRICELEVEL>
		                            <DATE>20240401</DATE>
		                            <PRICELEVELLIST>
		                                <STARTINGFROM></STARTINGFROM>
		                                <ENDINGAT></ENDINGAT>
		                                <RATE>100.00/mtr</RATE>
		                                <DISCOUNT></DISCOUNT>
		                            </PRICELEVELLIST>
		                        </FULLPRICELIST>
		                    </STOCKITEM>
		                </TALLYMESSAGE>
		            </REQUESTDATA>
		        </IMPORTDATA>
		    </BODY>
		</ENVELOPE>
		"""
	return xml_data

order = {"orderNo":34, "partyName":'Party 2', "sp":"", "stockItem":"Item 5", "itemDescription":"White x Silver 3x3m"}
mailingDetails = {"address":"","country":""}

check1 = ensure.ensure_party_ledger(order["partyName"],mailingDetails["address"])
check2 = ensure.ensure_stock_item(order["stockItem"])

if(check1 and check2):
	tally_xml = append_to_price_list(order["stockItem"],order["partyName"])
	response = tallyPush.send_to_tally(tally_xml)
	print(response)