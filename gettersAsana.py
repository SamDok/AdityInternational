import core
import requests

def get_asana_tasks():
    URL = f'https://app.asana.com/api/1.0/sections/{core.SECTION_ID}/tasks?opt_fields=name,custom_fields'
    response = requests.get(URL, headers=core.headers)
    if response.status_code == 200:
        tasks = response.json()['data']
        return tasks
    else:
        print(f"Error fetching tasks: {response.status_code}")
        return []


def get_task_details(task_id):
    """ Get details of a specific task, including description """
    URL = f'https://app.asana.com/api/1.0/tasks/{task_id}'
    response = requests.get(URL, headers=core.headers)
    #print(response.json)
    if response.status_code == 200:
        return response.json()['data']
    else:
        print(f"Error fetching tasks: {response.status_code}")
        return []

def get_section_id(projectId):

def get_project_id():

def get_subtasks_in_tasks(task_gid):
    """ Get all subtasks in a task """
    URL = f'https://app.asana.com/api/1.0/tasks/{task_gid}/subtasks?opt_fields=name,custom_fields'
    response = requests.get(URL, headers=core.headers)
    if response.status_code == 200:
        tasks = response.json()['data']
        return tasks
    else:
        print(f"Error fetching tasks: {response.status_code}")
        return []


#print(f"retuned value is {get_task_details(1207827154407878)}")