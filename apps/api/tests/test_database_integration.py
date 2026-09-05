import os

import pytest
from sqlalchemy import create_engine, text


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="PostgreSQL integration opt-in")
def test_real_postgres_connection():
    engine = create_engine(os.environ["TEST_DATABASE_URL"])
    try:
        with engine.connect() as connection:
            assert connection.execute(text("SELECT 1")).scalar_one() == 1
    finally:
        engine.dispose()
