import requests

def get_razas():
    r = requests.get('https://dog.ceo/api/breeds/list/all')
    print(r.status_code)
    # print(r.text)
    # print(type(r.text)) # Vemos de que tipo es el texto
    
    razas = r.json()
    for raza in razas.values():
        print(f"Raza de los perritos: {raza}")