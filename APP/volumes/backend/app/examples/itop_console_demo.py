import argparse
import getpass
import os
import sys
from pathlib import Path
from typing import Iterable

# Allow running this file from /app/examples without extra PYTHONPATH setup.
APP_ROOT = Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from integrations.itop_cmdb_connector import CIClass, iTopCMDBConnector, iTopObject, iTopResponse


def read_bool(name: str, default: bool = True) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def print_sample(title: str, items: Iterable[iTopObject], max_items: int = 10) -> None:
    print(f"\n{title}")
    count = 0
    for item in items:
        count += 1
        if count > max_items:
            break
        status = item.get("status") or item.get("lifecycle_status") or item.get("operational_status") or "-"
        print(
            f"- [{item.itop_class}#{item.id}] "
            f"{item.get('friendlyname', item.name)} | status={status}"
        )


def print_result(label: str, response: iTopResponse) -> None:
    print(f"\n{label}: code={response.code} message='{response.message}' total={len(response)}")


def token_preview(token: str) -> str:
    if len(token) <= 16:
        return token
    return f"{token[:10]}...{token[-8:]}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Demo de conector iTop: valida credenciales, valida token y lista objetos CMDB."
    )
    parser.add_argument("--base-url", default=os.getenv("ITOP_URL", "http://itop"), help="URL base de iTop")
    parser.add_argument("--user", help="Usuario iTop")
    parser.add_argument("--password", help="Password iTop")
    parser.add_argument("--token", help="Auth token iTop")
    parser.add_argument(
        "--verify-ssl",
        dest="verify_ssl",
        action="store_true",
        default=read_bool("ITOP_VERIFY_SSL", default=True),
        help="Validar certificado SSL (default: true)",
    )
    parser.add_argument(
        "--no-verify-ssl",
        dest="verify_ssl",
        action="store_false",
        help="No validar certificado SSL",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=int(os.getenv("ITOP_TIMEOUT_SECONDS", "30")),
        help="Timeout HTTP en segundos",
    )
    return parser.parse_args()


def ask_if_missing(value: str | None, prompt: str, secret: bool = False) -> str:
    if value:
        return value
    if secret:
        entered = getpass.getpass(prompt)
    else:
        entered = input(prompt).strip()
    if not entered:
        raise SystemExit(f"Valor requerido no proporcionado: {prompt}")
    return entered


def main() -> None:
    args = parse_args()
    base_url = args.base_url
    username = ask_if_missing(args.user, "Usuario iTop: ")
    password = ask_if_missing(args.password, "Password iTop: ", secret=True)
    token = ask_if_missing(args.token, "Token iTop: ", secret=True)
    verify_ssl = args.verify_ssl
    timeout = args.timeout

    connector: iTopCMDBConnector | None = None

    try:
        print(f"Conectando a iTop: {base_url}")
        print(f"Usuario lógico: {username}")
        print(f"Token preview: {token_preview(token)} (len={len(token)})")

        auth_result = iTopCMDBConnector.authenticate(
            base_url=base_url,
            username=username,
            password=password,
            token_store=lambda _username: token,
            verify_ssl=verify_ssl,
            timeout=timeout,
        )

        print(
            "Auth phases: "
            f"authorized={auth_result.authorized} "
            f"has_token={auth_result.has_token} "
            f"token_valid={auth_result.token_valid}"
        )

        if not auth_result.ok or auth_result.connector is None:
            raise SystemExit(f"Autenticación fallida: {auth_result.error}")

        connector = auth_result.connector
        print("Autenticación completa: credenciales OK + token válido")

        persons = connector.get(
            CIClass.PERSON,
            "SELECT Person",
            output_fields="id,name,first_name,email,status,friendlyname",
        )
        print_result("Person", persons)
        print_sample("Muestra personas", persons.items())

        organizations = connector.get(
            CIClass.ORGANIZATION,
            "SELECT Organization",
            output_fields="id,name,code,status,friendlyname",
        )
        print_result("Organization", organizations)
        print_sample("Muestra organizaciones", organizations.items())

        cis = connector.get(
            CIClass.FUNCTIONAL_CI,
            "SELECT FunctionalCI",
            output_fields="id,name,finalclass,org_id,friendlyname",
        )
        print_result("FunctionalCI", cis)
        print_sample("Muestra activos CMDB", cis.items())

        if len(cis) == 0:
            print("\nNo se encontraron activos CMDB en FunctionalCI.")

    finally:
        if connector:
            connector.close()


if __name__ == "__main__":
    main()
