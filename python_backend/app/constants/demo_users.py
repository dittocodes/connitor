from typing import TypedDict


class DemoUser(TypedDict):
    id: str
    name: str
    phone: str
    role: str
    hospitalChainId: str | None
    branchId: str | None


DEFAULT_DEMO_USER_ID = "11111111-1111-1111-1111-111111111111"

DEMO_USERS_BY_ID: dict[str, DemoUser] = {
    "11111111-1111-1111-1111-111111111111": {
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "Sushobhit Kundra",
        "phone": "6987456321",
        "role": "SUPER_ADMIN",
        "hospitalChainId": None,
        "branchId": None,
    },
    "22222222-2222-2222-2222-222222222222": {
        "id": "22222222-2222-2222-2222-222222222222",
        "name": "Rajesh Kumar",
        "phone": "8482022111",
        "role": "CHAIN_ADMIN",
        "hospitalChainId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "branchId": None,
    },
    "33333333-3333-3333-3333-333333333333": {
        "id": "33333333-3333-3333-3333-333333333333",
        "name": "Anil Patel",
        "phone": "7980427511",
        "role": "BRANCH_ADMIN",
        "hospitalChainId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "branchId": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    },
    "99999999-9999-9999-9999-999999999999": {
        "id": "99999999-9999-9999-9999-999999999999",
        "name": "Rameshwar Tiwari",
        "phone": "9883578111",
        "role": "SECURITY",
        "hospitalChainId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "branchId": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    },
    "88888888-8888-8888-8888-888888888888": {
        "id": "88888888-8888-8888-8888-888888888888",
        "name": "Dr. Arjun Desai",
        "phone": "7003636111",
        "role": "STAFF",
        "hospitalChainId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "branchId": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    },
}


def resolve_demo_user(x_demo_user_id: str | None) -> DemoUser:
    if x_demo_user_id and x_demo_user_id in DEMO_USERS_BY_ID:
        return DEMO_USERS_BY_ID[x_demo_user_id]
    return DEMO_USERS_BY_ID[DEFAULT_DEMO_USER_ID]
