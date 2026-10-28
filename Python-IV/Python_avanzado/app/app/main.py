import utils
import read_csv
import charts
import pandas as pd

def run():
    '''
    # Código antiguo comentado (manual)
    data = read_csv.read_csv('data.csv')
    data = list(filter(lambda item : item['Continent'] == 'South America',data))
    countries = list(map(lambda x: x['Country'], data))
    percentages = list(map(lambda x: float(x['World Population Percentage']), data))
    '''

    # Nuevo código usando Pandas
    df = pd.read_csv('data.csv')
    df = df[df['Continent'] == 'South America'] # O 'Africa', como pide el final del video
    countries = df['Country'].values
    percentages = df['World Population Percentage'].values.astype(float) # <-- Agregado .astype(float)
    
    charts.generate_pie_chart(countries, percentages)

    # --- Resto del código original ---
    # Leemos de nuevo 'data' para que la consulta por país de abajo siga funcionando
    data = read_csv.read_csv('data.csv') 
    country = input('Type Country => ')
    print(country)

    result = utils.population_by_country(data, country)

    if len(result) > 0:
        country_data = result[0]
        print(country_data)
        labels, values = utils.get_population(country_data)
        charts.generate_bar_chart(country_data['Country'], labels, values)

if __name__ == '__main__':
    run()