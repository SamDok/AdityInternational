import requests
from collections import defaultdict
import re
import core
import gettersAsana
from datetime import datetime


def clean_all_orders(tasks):
    tally_order = []
    for task in tasks:
        details = task["name"].split(" - ")
        subtasks = gettersAsana.get_subtasks_in_tasks(task["gid"])
        asana_description = gettersAsana.get_task_details(task['gid'])
        task_id = task["gid"]
        for subtask in subtasks:
            temp = {"partyName":"","stockItem":"","itemDescription":"","sp":0,"qty":0,"unit":"","currency":"","ledger_name":"","due_on":"","gid":""}
            temp["partyName"] = details[0]
            temp["stockItem"] = details[1]
            temp["itemDescription"] = subtask["name"]
            basic_qty = subtask["name"].split(" - ")
            q1 = re.findall(r'-?\d+\.?\d*', basic_qty[1])
            temp_string = basic_qty[1].split(' ')
            temp["unit"] = temp_string[3]
            temp["sp"] = asana_description['notes'].split(' ')[1] or 0
            temp["currency"] = asana_description['notes'].split(' ')[0]
            temp["qty"] = float(q1[0]) * float(q1[1])
            temp_ledger_character = details[1].split('/')
            temp["ledger_name"] = core.ledger_name[temp_ledger_character[1]]

            date_obj = datetime.strptime(asana_description['due_on'], "%Y-%m-%d")

            # Convert datetime object to desired format (dd-monthname-yyyy)
            formatted_date = date_obj.strftime("%d-%B-%Y")

            temp["due_on"] = formatted_date
            temp["gid"] = task_id
            tally_order.append(temp)
            #print(f"temp = {temp}")
            #print(f"tally_order = {tally_order}")

    tally_order = merge_all_order(tally_order)

    return tally_order

def merge_all_order(data):
    # Create a defaultdict of dictionaries with lists as default values
    merged_data = defaultdict(lambda: defaultdict(list))
    # Iterate through the list of dictionaries
    for entry in data:
    # Get the id value to use as the key
        id_value = entry['partyName']
        # Iterate through the dictionary items
        for key, value in entry.items():
            # Append the value to the list for the corresponding key
            merged_data[id_value][key].append(value)

    # Convert the defaultdict back to a regular dictionary if needed
    merged_data = {k: dict(v) for k, v in merged_data.items()}
    
    # Convert the merged_data dictionary back to a list of dictionaries if needed
    merged_list = [{**{'partyName': id_value}, **attributes} for id_value, attributes in merged_data.items()]

    final_list = []
    for lists in merged_list:
        lists["partyName"] = list(dict.fromkeys(lists["partyName"]))
        final_list.append(lists)

    return final_list


# Get tasks in the specific column if section ID is found
#tasks = gettersAsana.get_asana_tasks()
#print(clean_all_orders(tasks))



