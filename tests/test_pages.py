def test_homepage_serves_react_shell_and_valid_description(client):
    response = client.get("/")

    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert '<div id="root"></div>' in html
    assert html.count('<meta name="description"') == 1
    assert (
        '<meta name="description" content="ZimOsaka AutoSpares sources complete engines '
        'from Dubai to order, with a full landed-cost quote covering freight, ZIMRA duty, '
        'VAT, clearing and delivery across Zimbabwe." />'
    ) in html
    assert 'type="module"' in html
