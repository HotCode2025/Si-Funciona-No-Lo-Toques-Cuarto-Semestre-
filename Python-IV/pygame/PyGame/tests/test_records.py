from records import cargar_record, guardar_record


def test_guardar_y_cargar(tmp_path):
    ruta = tmp_path / 'record.json'
    guardar_record(340, ruta)
    assert cargar_record(ruta) == 340


def test_archivo_inexistente_o_roto_devuelve_cero(tmp_path):
    assert cargar_record(tmp_path / 'no_existe.json') == 0
    roto = tmp_path / 'roto.json'
    roto.write_text('esto no es json')
    assert cargar_record(roto) == 0
    lista = tmp_path / 'lista.json'
    lista.write_text('[1, 2, 3]')
    assert cargar_record(lista) == 0
