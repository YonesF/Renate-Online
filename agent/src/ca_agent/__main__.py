"""Start: python -m ca_agent"""

import sys

import uvicorn

from ca_agent.config import Config, ConfigError
from ca_agent.main import create_app


def main() -> int:
    try:
        config = Config.from_env()
    except ConfigError as error:
        print(f"agent: {error}", file=sys.stderr)
        return 2

    uvicorn.run(create_app(config), host=config.bind_host, port=config.bind_port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
