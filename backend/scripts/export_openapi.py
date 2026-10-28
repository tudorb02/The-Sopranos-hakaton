from pathlib import Path

import yaml

from app.main import app

TARGET = Path(__file__).resolve().parents[2] / "api" / "openapi.yaml"


def export():
    TARGET.parent.mkdir(exist_ok=True)
    TARGET.write_text(yaml.safe_dump(app.openapi(), allow_unicode=True, sort_keys=False), encoding="utf-8")


if __name__ == "__main__":
    export()
