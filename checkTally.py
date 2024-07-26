import tallyPush
import requests
import tallyPush
from xml.etree import ElementTree as ET


def check_party_ledger_existence(ledger_name):


    #The XML that brings out LEDGERS of a particular name
    #It returns blank in the collection field if not ledger is found

    tally_xml = f"""
    <ENVELOPE>
        <HEADER>
            <VERSION>1</VERSION>
            <TALLYREQUEST>Export</TALLYREQUEST>
            <TYPE>Collection</TYPE>
            <ID>Ledgers</ID>
        </HEADER>
        <BODY>
            <DESC>
                <STATICVARIABLES>
                    <SVCURRENTCOMPANY>Trial</SVCURRENTCOMPANY>
                    <SVEXPORTFORMAT>SysName:XML</SVEXPORTFORMAT>
                </STATICVARIABLES>
                <TDL>
                    <TDLMESSAGE>
                        <COLLECTION ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No" NAME="Ledgers">
                            <TYPE>Ledger</TYPE>                             
                            <BELONGSTO>Yes</BELONGSTO>
                            <NATIVEMETHOD>Name</NATIVEMETHOD>
                            <FILTERS>{ledger_name}</FILTERS>
                        </COLLECTION>
                        <SYSTEM TYPE="Formulae" NAME="{ledger_name}">$Name = '{ledger_name}'</SYSTEM>
                    </TDLMESSAGE>
                </TDL>
            </DESC>
        </BODY>             
    </ENVELOPE>
    """
    
    response = tallyPush.send_to_tally(tally_xml)
    print(response)
    return 'LEDGER NAME' in response

def check_stock_item(stock_item_name):
    xml_data = f"""
    <ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Export Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <EXPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Stock Summary</REPORTNAME>
                <STATICVARIABLES>
                    <SVCURRENTCOMPANY>Trial</SVCURRENTCOMPANY>
                </STATICVARIABLES>
            </REQUESTDESC>
            </EXPORTDATA>
        </BODY>
    </ENVELOPE>
    """
    response = tallyPush.send_to_tally(xml_data)
    #print(response)
    root = ET.fromstring(response)
    
    # Check if the stock item is present in the response
    stock_items = root.findall('.//DSPACCNAME')
    #print(f"listof all stock items = {stock_items}")
    for item in stock_items:
        name = item.find('DSPDISPNAME').text
        #print(f"items names = {name}")
        if name == stock_item_name:
            return True
        
    return False

def check_last_order_number():
    xml_data = """
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Export Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <EXPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Voucher Register</REPORTNAME>
                <STATICVARIABLES>
                    <SVFROMDATE>20240401</SVFROMDATE>
                    <SVTODATE>20240401</SVTODATE>
                    <SVCURRENTCOMPANY>Trial</SVCURRENTCOMPANY>
                    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    <SVVOUCHERTYPE>Sales Order</SVVOUCHERTYPE>
                </STATICVARIABLES>
            </REQUESTDESC>
        </EXPORTDATA>
    </BODY>
</ENVELOPE>
"""
    response = tallyPush.send_to_tally(xml_data)
    root = ET.fromstring(response)
    last_sales_order = None
    for voucher in root.findall(".//VOUCHER"):
        last_sales_order = voucher.find("REFERENCE").text


    return last_sales_order

print(check_party_ledger_existence('CLASSIC TEXTILE'))
