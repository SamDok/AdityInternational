import schedule
import time
import gettersAsana
import fetchAsanaTasks
import createSalesOrder
import pushAsana


# Define your function
def get_orders():
    print("Started tally functions")
    all_tasks = gettersAsana.get_asana_tasks()
    tasks = fetchAsanaTasks.clean_all_orders(all_tasks)
    if tasks is not []:
        createSalesOrder.push_to_xml(tasks)
        for task in tasks:
            gid_list = task["gid"]
            gid_list = list(dict.fromkeys(gid_list))
            for taskId in gid_list:
                pushAsana.move_task_to_section(taskId)

        
    #    print(success)
    #print(orders1)
    #print("##################################################")
    #print(orders)
        

# Schedule the function to run every 10 seconds
schedule.every(10).seconds.do(get_orders)

# Keep the script running
while True:
    schedule.run_pending()
    time.sleep(1)
