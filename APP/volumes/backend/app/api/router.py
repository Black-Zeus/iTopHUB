from fastapi import APIRouter

from api.routes.auth import router as auth_router
from api.routes.checklists import router as checklists_router
from api.routes.handover import router as handover_router
from api.routes.integrations import router as integrations_router
from api.routes.itop import router as itop_router
from api.routes.settings import router as settings_router
from api.routes.system import router as system_router
from api.routes.users import router as users_router


api_router = APIRouter()
api_router.include_router(system_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(itop_router)
api_router.include_router(integrations_router)
api_router.include_router(settings_router)
api_router.include_router(checklists_router)
api_router.include_router(handover_router)
