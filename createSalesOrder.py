import requests
import ensure
import tallyPush
import logging
import xml.etree.ElementTree as ET
import gettersAsana
import fetchAsanaTasks
import checkTally
import core

def create_tally_xml(order,orderNo,date):
    tally_xml = '<ENVELOPE>'
    tally_xml +='<HEADER>'
    tally_xml +='<TALLYREQUEST>Import Data</TALLYREQUEST>'
    tally_xml +='</HEADER>'
    tally_xml +='<BODY>'
    tally_xml +='<IMPORTDATA>'
    tally_xml +='<REQUESTDESC>'
    tally_xml +='<REPORTNAME>Vouchers</REPORTNAME>'
    tally_xml +='<STATICVARIABLES>'
    tally_xml +='<SVCURRENTCOMPANY>Trial</SVCURRENTCOMPANY>'
    tally_xml +='</STATICVARIABLES>'
    tally_xml +='</REQUESTDESC>'
    tally_xml +='<REQUESTDATA>'
    tally_xml +='<TALLYMESSAGE xmlns:UDF="TallyUDF">'
    tally_xml +='<VOUCHER VCHTYPE="Sales Order" ACTION="Create" OBJVIEW="Invoice Voucher View">'
    #tally_xml +='<BASICBUYERADDRESS.LIST TYPE="String">'
    #tally_xml +='<BASICBUYERADDRESS>Temp</BASICBUYERADDRESS>'
    #tally_xml +='</BASICBUYERADDRESS.LIST>'
    tally_xml +=f'<DATE>{date}</DATE>'
    tally_xml +=f'<PARTYNAME>{order["partyName"][0]}</PARTYNAME>'
    tally_xml +=f'<PARTYLEDGERNAME>{order["partyName"][0]}</PARTYLEDGERNAME>'
    tally_xml +='<VOUCHERTYPENAME>Sales Order</VOUCHERTYPENAME>'
    tally_xml +=f'<REFERENCE>{orderNo}</REFERENCE>'
    tally_xml +=f'<VOUCHERNUMBER>{orderNo}</VOUCHERNUMBER>'
    tally_xml +=f'<BASICBASEPARTYNAME>{order["partyName"][0]}</BASICBASEPARTYNAME>'
    tally_xml +=f'<ALTERID>{orderNo}</ALTERID>'
    tally_xml +=f'<MASTERID>{orderNo}</MASTERID>'

    total = 0
    currencies = core.push_exchange_rate()
    conversion_value = currencies[order["currency"][0]]
    for i in range(len(order["stockItem"])):
        tally_xml +='<INVENTORYENTRIES.LIST>'
        tally_xml +='<BASICUSERDESCRIPTION.LIST TYPE="String">' 
        tally_xml +=f'<BASICUSERDESCRIPTION>{order["itemDescription"][i]}</BASICUSERDESCRIPTION>'
        tally_xml +='</BASICUSERDESCRIPTION.LIST>'
        tally_xml +=f'<STOCKITEMNAME>{order["stockItem"][i]}</STOCKITEMNAME>'
        tally_xml +=f'<RATE>{order["sp"][i]} {order["currency"][i]} = INR {round(conversion_value * float(order["sp"][i]), 2)} /{order["unit"][i]}</RATE>'
        tally_xml +=f'<AMOUNT>-{round(float(order["sp"][i]) * float(order["qty"][i]), 2)} {order["currency"][i]} @ INR {conversion_value}/ {order["currency"][i]} = INR -{round(float(order["sp"][i]) * float(order["qty"][i]) * conversion_value,2)}</AMOUNT>'
        tally_xml +=f'<ACTUALQTY>{order["qty"][i]} {order["unit"][i]}</ACTUALQTY>'
        tally_xml +=f'<BILLEDQTY> {order["qty"][i]} {order["unit"][i]}</BILLEDQTY>'
        tally_xml +='<BATCHALLOCATIONS.LIST>'
        tally_xml +='<BATCHNAME>Primary Batch</BATCHNAME>'
        tally_xml +='<INDENTNO/>'
        tally_xml +=f'<ORDERNO>{orderNo}</ORDERNO>'
        tally_xml +='<TRACKINGNUMBER/>'
        tally_xml +='<DYNAMICCSTISCLEARED>No</DYNAMICCSTISCLEARED>'
        tally_xml +=f'<AMOUNT>{round(float(order["sp"][i]) * float(order["qty"][i]), 2)} {order["currency"][i]} @ INR {conversion_value}/ {order["currency"][i]} = INR {round(float(order["sp"][i]) * float(order["qty"][i]) * conversion_value,2)}</AMOUNT>'

        total += round(float(order["sp"][i]) * float(order["qty"][i]) * conversion_value, 2)

        tally_xml +=        f'<ACTUALQTY> {order["qty"][i]} {order["unit"][i]}</ACTUALQTY>'
        tally_xml +=        f'<BILLEDQTY> {order["qty"][i]} {order["unit"][i]}</BILLEDQTY>'
        tally_xml +=        f'<ORDERDUEDATE JD="45382" P="{order["due_on"][i]}">{order["due_on"][i]}</ORDERDUEDATE>'
        tally_xml +=       '</BATCHALLOCATIONS.LIST>'
        tally_xml +=       '<ACCOUNTINGALLOCATIONS.LIST>'
        tally_xml +=        '<OLDAUDITENTRYIDS.LIST TYPE="Number">'
        tally_xml +=         '<OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>'
        tally_xml +=        '</OLDAUDITENTRYIDS.LIST>'
        tally_xml +=        f'<LEDGERNAME>{order["ledger_name"][0]}</LEDGERNAME>'
        tally_xml +=        '<GSTCLASS/>'
        tally_xml +=        '<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>'
        tally_xml +=        '<LEDGERFROMITEM>No</LEDGERFROMITEM>'
        tally_xml +=        '<REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>'
        tally_xml +=        '<ISPARTYLEDGER>No</ISPARTYLEDGER>'
        tally_xml +=        '<ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>'
        tally_xml +=        '<ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>'
        tally_xml +=        '<ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>'
        tally_xml +=        f'<AMOUNT>{round(float(order["sp"][i]) * float(order["qty"][i]), 2)} {order["currency"][i]} @ INR {conversion_value}/ {order["currency"][i]} = INR {round(float(order["sp"][i]) * float(order["qty"][i]) * conversion_value,2)}</AMOUNT>'
        tally_xml +=      '</ACCOUNTINGALLOCATIONS.LIST>'
        tally_xml +=      '</INVENTORYENTRIES.LIST>'

    tally_xml +=      '<LEDGERENTRIES.LIST>'
    tally_xml +=        '<OLDAUDITENTRYIDS.LIST TYPE="Number">'
    tally_xml +=        '<OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>'
    tally_xml +=       '</OLDAUDITENTRYIDS.LIST>'
    tally_xml +=       f'<LEDGERNAME>{order["partyName"][0]}</LEDGERNAME>'
    tally_xml +=       '<GSTCLASS/>'
    tally_xml +=       '<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>'
    tally_xml +=       '<LEDGERFROMITEM>No</LEDGERFROMITEM>'
    tally_xml +=       '<REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>'
    tally_xml +=       '<ISPARTYLEDGER>Yes</ISPARTYLEDGER>'
    tally_xml +=       '<ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>'
    tally_xml +=       '<ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>'
    tally_xml +=       '<ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>'
    tally_xml +=       f'<AMOUNT>-{total}</AMOUNT>'
    tally_xml +=      '</LEDGERENTRIES.LIST>'
    tally_xml +=     '</VOUCHER>'
    tally_xml +=    '</TALLYMESSAGE>'
    tally_xml +=   '</REQUESTDATA>'
    tally_xml +=  '</IMPORTDATA>'
    tally_xml += '</BODY>'
    tally_xml +='</ENVELOPE>'

    #print(f"total is = {total}")
    #print(f"Tally xml = {tally_xml}")
    return tally_xml


def push_to_xml(orders):
    date = "20240401"

    #expandeddate = datetime.datetime.now()
    #formatted_date = current_date.strftime("%Y%m%d")
    mailingDetails = {"address":"","country":""}
    incompleted_tasks = []
    for order in orders:
        orderNo = checkTally.check_last_order_number()
        orderNo = int(orderNo) + 1
        check1 = ensure.ensure_party_ledger(order["partyName"][0],mailingDetails["address"])

        for item in order["stockItem"]:
            check2 = ensure.ensure_stock_item(item)

        if(check1 and check2):
            tally_xml = create_tally_xml(order,orderNo,date)
            response = tallyPush.send_to_tally(tally_xml)
            
        

#orders = gettersAsana.get_asana_tasks()
#orders = fetchAsanaTasks.clean_all_orders(orders)
#print(orders)
#push_to_xml(orders)
