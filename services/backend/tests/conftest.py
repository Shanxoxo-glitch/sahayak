import asyncio
import pytest
from app.database import engine, Base
import app.models  # Ensure all SQLAlchemy models are registered on Base.metadata

@pytest.fixture(autouse=True, scope="session")
def initialize_test_database():
    async def _create():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    asyncio.run(_create())
    yield
