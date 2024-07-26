import tallyPush

def create_party_ledger(ledger_name,mailingDetails):
    
    #By default the address field is blank so have to put an address 
    #for the customer being created

    if mailingDetails == "":
        mailingDetails = input("please enter address of the customer")
        #mailingDetails["country"] = input("please enter country of the customer")

    #The XML to add a new customer,

    tally_xml = f"""
    <ENVELOPE>
        <HEADER>
            <TALLYREQUEST>Import Data</TALLYREQUEST>
        </HEADER>
        <BODY>
            <IMPORTDATA>
                <REQUESTDESC>
                    <REPORTNAME>All Masters</REPORTNAME>
                </REQUESTDESC>
                <REQUESTDATA>
                    <TALLYMESSAGE xmlns:UDF="TallyUDF">
                        <LEDGER NAME="{ledger_name}" RESERVEDNAME="">
                            <NAME.LIST>
                                <NAME>{ledger_name}</NAME>
                            </NAME.LIST>
                            <PARENT>Sundry Debtors</PARENT>
                            <ISBILLWISEON>Yes</ISBILLWISEON>
                            <ISINTERESTON>Yes</ISINTERESTON>
                             <ADDRESS.LIST>
                                <ADDRESS>{mailingDetails}</ADDRESS>
                            </ADDRESS.LIST>
                        </LEDGER>
                    </TALLYMESSAGE>
                </REQUESTDATA>
            </IMPORTDATA>
        </BODY>
    </ENVELOPE>
    """
    response = tallyPush.send_to_tally(tally_xml)
    return 'RESPONSE' in response and '<LINEERROR>' not in response

def create_stock_item(itemName):
    tally_xml = f"""
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
                    <STOCKITEM NAME="{itemName}" RESERVERDNAME="">
                        <OLDAUDITENTRYIDS.LIST TYPE="Number">
                            <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
                        </OLDAUDITENTRYIDS.LIST>
                        <PARENT/>
                        <CATEGORY/>
                        <GSTAPPLICABLE>&#4; Applicable</GSTAPPLICABLE>
                        <TAXCLASSIFICATIONNAME/>
                        <GSTTYPEOFSUPPLY>Goods</GSTTYPEOFSUPPLY>
                        <COSTINGMETHOD>Avg. Cost</COSTINGMETHOD>
                        <VALUATIONMETHOD>Avg. Price</VALUATIONMETHOD>
                        <BASEUNITS>mtr</BASEUNITS>
                        <ADDITIONALUNITS/>
                        <ISCOSTCENTRESON>No</ISCOSTCENTRESON>
                        <ISBATCHWISEON>No</ISBATCHWISEON>
                        <ISPERISHABLEON>No</ISPERISHABLEON>
                        <LANGUAGENAME.LIST>
                            <NAME.LIST TYPE="String">
                                <NAME>{itemName}</NAME>
                            </NAME.LIST>
                            <LANGUAGEID>1033</LANGUAGEID>
                        </LANGUAGENAME.LIST>
                        <SCHVIDETAILS.LIST/>
                        <EXCISETARIFFDETAILS.LIST/>
                        <TCSCATEGORYDETAILS.LIST/>
                        <TDSCATEGORYDETAILS.LIST/>
                        <EXCLUDEDTAXATIONS.LIST/>
                        <OLDAUDITENTRIES.LIST/>
                        <ACCOUNTAUDITENTRIES.LIST/>
                        <AUDITENTRIES.LIST/>
                        <MRPDETAILS.LIST/>
                        <VATCLASSIFICATIONDETAILS.LIST/>
                        <COMPONENTLIST.LIST/>
                        <ADDITIONALLEDGERS.LIST/>
                        <SALESLIST.LIST/>
                        <PURCHASELIST.LIST/>
                        <FULLPRICELIST.LIST/>
                        <BATCHALLOCATIONS.LIST/>
                        <TRADEREXCISEDUTIES.LIST/>
                        <STANDARDCOSTLIST.LIST/>
                        <STANDARDPRICELIST.LIST/>
                        <EXCISEITEMGODOWN.LIST/>
                        <MULTICOMPONENTLIST.LIST/>
                        <LBTDETAILS.LIST/>
                        <PRICELEVELLIST.LIST/>
                        <GSTCLASSFNIGSTRATES.LIST/>
                        <EXTARIFFDUTYHEADDETAILS.LIST/>
                        <TEMPGSTITEMSLABRATES.LIST/>
                    </STOCKITEM>
                </TALLYMESSAGE>
            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
    </ENVELOPE>

        """
    #print(tally_xml)
    response = tallyPush.send_to_tally(tally_xml)
    #print(f"response is: {response}")
    return 'RESPONSE' in response and '<LINEERROR>' not in response