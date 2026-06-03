import os


def _inject_app_mode(host: str, domain_route_map: dict, html_dir: str) -> tuple[bool, str]:
    """If the host matches a mapped domain, inject __APP_MODE__ into index.html.
    Returns (success, html_content)."""
    route_name = domain_route_map.get(host, None)
    index_file = os.path.join(html_dir, "index.html")
    if not os.path.exists(index_file):
        return False, ""

    with open(index_file, "r", encoding="utf-8") as f:
        html = f.read()

    if route_name:
        inject_script = f"""<script>
    window.__APP_MODE__ = "{route_name}";
</script>
"""
        html = html.replace("</head>", f"    {inject_script}</head>")
    return True, html
