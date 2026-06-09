"""
Academic Support Platform Backend
Main entry point — app creation, middleware, static files, and router mounting.
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import os

# Configuration and database
from config_loader import get_config_manager, start_hot_reload, get
from database import get_db, init_database, get_engine, get_db_manager, Base

# Initialize configuration and database (order matters)
config_manager = get_config_manager()
db_manager = init_database()
engine = get_engine()

# Models (import after Base is defined to register tables)
from models import UserGroup, AdminUser

# Security utilities
from utils.security import get_password_hash

# Admin default config
DEFAULT_ADMIN_USERNAME = get('admin.default_username', 'admin')
DEFAULT_ADMIN_PASSWORD = get('admin.default_password', 'admin123')

# CORS config
ALLOWED_ORIGINS = get('cors.allowed_origins', [])

# Domain route config
DOMAIN_ROUTE_MAP = get('domain_routes', {}) or {}

# Static files config
HTML_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    get('static.html_dir', 'html') or 'html'
)

# Create all tables
Base.metadata.create_all(bind=engine)


# =============================================================================
# HTML injection helper
# =============================================================================
def _inject_app_mode(host: str, domain_route_map: dict, html_dir: str) -> tuple:
    """If the host matches a mapped domain, inject __APP_MODE__ into index.html.
    Returns (success, html_content)."""
    route_name = domain_route_map.get(host, None)
    index_file = os.path.join(html_dir, "index.html")
    if not os.path.exists(index_file):
        return False, ""

    with open(index_file, "r", encoding="utf-8") as f:
        html = f.read()

    # Inject __APP_MODE__ if domain route matches
    head_extra = ""
    if route_name:
        head_extra += f"""<script>window.__APP_MODE__ = "{route_name}";</script>"""

    if head_extra:
        html = html.replace("</head>", f"    {head_extra}</head>")
    return True, html


# =============================================================================
# Lifespan — startup/shutdown
# =============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure default admin exists
    db = next(get_db())
    try:
        admin = db.query(AdminUser).filter(AdminUser.username == DEFAULT_ADMIN_USERNAME).first()
        if not admin:
            print(f"👤 Creating default admin user: {DEFAULT_ADMIN_USERNAME}")
            group = db.query(UserGroup).filter(UserGroup.name == "SuperAdmin").first()
            if not group:
                group = UserGroup(
                    name="SuperAdmin",
                    description="Super administrator with all permissions",
                    permissions="all"
                )
                db.add(group)
                db.commit()
                db.refresh(group)

            new_admin = AdminUser(
                username=DEFAULT_ADMIN_USERNAME,
                hashed_password=get_password_hash(DEFAULT_ADMIN_PASSWORD),
                full_name="System Administrator",
                is_active=True,
                group_id=group.id
            )
            db.add(new_admin)
            db.commit()
            print("✅ Default admin user created successfully!")
    except Exception as e:
        print(f"❌ Error during startup initialization: {e}")
    finally:
        db.close()
    yield


# =============================================================================
# App creation
# =============================================================================
app = FastAPI(title="Academic Support Platform Backend", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Root route
# =============================================================================
@app.get("/", response_model=None)
def read_root(request: Request):
    # If browser request (Accept includes text/html), return frontend page
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        host = request.headers.get("host", "").split(":")[0]
        ok, html = _inject_app_mode(host, DOMAIN_ROUTE_MAP, HTML_DIR)
        if ok:
            return Response(content=html, media_type="text/html; charset=utf-8")

    db = get_db_manager().get_session()
    try:
        if not db.query(UserGroup).filter(UserGroup.name == "SuperAdmin").first():
            super_group = UserGroup(name="SuperAdmin", description="Super Administrator Group", permissions="all")
            db.add(super_group)
            db.commit()
        admin_user = db.query(AdminUser).filter(AdminUser.username == DEFAULT_ADMIN_USERNAME).first()
        if not admin_user:
            super_group = db.query(UserGroup).filter(UserGroup.name == "SuperAdmin").first()
            admin_user = AdminUser(username=DEFAULT_ADMIN_USERNAME, hashed_password=get_password_hash(DEFAULT_ADMIN_PASSWORD), group_id=super_group.id)
            db.add(admin_user)
            db.commit()
    finally:
        db.close()
    return {"message": "Academic Support Platform Backend is Running!"}


# =============================================================================
# API Routers
# =============================================================================
from api.auth import router as auth_router
from api.admin import router as admin_router
from api.ai import router as ai_router
from api.topic import router as topic_router
from api.thesis import router as thesis_router
from api.grant import router as grant_router
from api.literature import lit_router, enhance_router, lit_compare_router
from api.bio import router as bio_router

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(ai_router)
app.include_router(topic_router)
app.include_router(thesis_router)
app.include_router(grant_router)
app.include_router(lit_router)
app.include_router(enhance_router)
app.include_router(lit_compare_router)
app.include_router(bio_router)


# =============================================================================
# Static files and frontend catch-all
# =============================================================================
if os.path.exists(HTML_DIR):

    app.mount("/assets", StaticFiles(directory=os.path.join(HTML_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}", response_model=None)
    async def serve_frontend(full_path: str, request: Request):
        """Catch-all: inject __APP_MODE__ based on Host header and return index.html."""
        host = request.headers.get("host", "").split(":")[0]
        ok, html = _inject_app_mode(host, DOMAIN_ROUTE_MAP, HTML_DIR)
        if ok:
            return Response(content=html, media_type="text/html; charset=utf-8")
        raise HTTPException(status_code=404, detail="Frontend not found")


# =============================================================================
# Entry point
# =============================================================================
if __name__ == "__main__":
    print("🚀 Starting Academic Support Platform Backend...")
    print(f"📄 Config file: {config_manager.config_path}")
    start_hot_reload()

    server_host = get('server.host', '0.0.0.0')
    server_port = get('server.port', 8000)
    server_reload = get('server.reload', True)

    print(f"🌐 Server will start on http://{server_host}:{server_port}")
    print("💡 Tip: Modify config.yaml to change settings. Changes will be auto-reloaded!")
    print("=" * 60)

    uvicorn.run("main:app", host=server_host, port=server_port, reload=server_reload)
