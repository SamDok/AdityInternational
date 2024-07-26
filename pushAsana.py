import requests
import core

def move_task_to_section(task_id):
    """ Move a specific task to a new section """
    url = f'https://app.asana.com/api/1.0/sections/{core.SECTION_ID_MOVE}/addTask'
    data = {
        'data': {
            'task': task_id  # Task ID you want to move
        }
    }
    response = requests.post(url, headers=core.headers, json=data)
    print(response)
    #return response.json()

# Example usage
#task_id = '1207808809978120'  # Task ID you want to move
#new_section_id = 'new_section_id'  # ID of the section you want to move the task to
#response = move_task_to_section(task_id)#, new_section_id)

#print(response)
