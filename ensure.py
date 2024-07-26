import createEntries
import checkTally
import logging

def ensure_stock_item(stockItem):
    item = checkTally.check_stock_item(stockItem)
    if not item:
        print(f"item is:{item}")
        created = createEntries.create_stock_item(stockItem)
        print(f"created is:{created}")
        if not created:
            logging.error(f"Failed to create stockItem: {stockItem}")
            return False
    return True

def ensure_party_ledger(ledger_name,mailingDetails):
    ledger = checkTally.check_party_ledger_existence(ledger_name)
    if not ledger:
        created = createEntries.create_party_ledger(ledger_name,mailingDetails)
        if not created:
            logging.error(f"Failed to create party ledger: {ledger_name}")
            return False
        
    return True
