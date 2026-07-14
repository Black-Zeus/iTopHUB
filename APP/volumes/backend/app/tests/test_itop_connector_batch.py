import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from integrations.itop_cmdb_connector import iTopCMDBConnector, iTopResponse


def _relation_row(row_id: int, contact_id: int) -> dict:
    return {
        "class": "lnkContactToFunctionalCI",
        "key": str(row_id),
        "fields": {
            "id": str(row_id),
            "functionalci_id": "42",
            "contact_id": str(contact_id),
        },
    }


class FakeConnector(iTopCMDBConnector):
    def __init__(self, responses):
        self.responses = list(responses)
        self.get_calls = []
        self.delete_calls = []
        self._relation_link_cache = {}

    def get(self, itop_class, key, output_fields="*"):
        self.get_calls.append((itop_class, key, output_fields))
        if self.responses:
            return self.responses.pop(0)
        return iTopResponse(code=0, message="OK", objects={}, raw={})

    def delete(self, itop_class, key, simulate=True, comment=""):
        self.delete_calls.append((itop_class, key, simulate, comment))
        return iTopResponse(code=0, message="OK", objects={}, raw={})


class ContactRelationBatchTests(unittest.TestCase):
    def test_fetch_contact_relation_links_uses_single_batch_query(self):
        connector = FakeConnector([
            iTopResponse(
                code=0,
                message="OK",
                objects={
                    "lnkContactToFunctionalCI::501": _relation_row(501, 10),
                    "lnkContactToFunctionalCI::502": _relation_row(502, 20),
                },
                raw={},
            )
        ])

        result = connector._fetch_contact_relation_links(
            "lnkContactToFunctionalCI",
            "functionalci_id",
            42,
            [10, 20],
            "id,functionalci_id,contact_id",
        )

        self.assertEqual(sorted(result.keys()), [10, 20])
        self.assertEqual(len(connector.get_calls), 1)
        self.assertIn("contact_id IN (10,20)", connector.get_calls[0][1])

    def test_fetch_contact_relation_links_falls_back_to_or_query(self):
        connector = FakeConnector([
            iTopResponse(code=1, message="Unsupported IN", objects={}, raw={}),
            iTopResponse(
                code=0,
                message="OK",
                objects={"lnkContactToFunctionalCI::501": _relation_row(501, 10)},
                raw={},
            ),
        ])

        result = connector._fetch_contact_relation_links(
            "lnkContactToFunctionalCI",
            "functionalci_id",
            42,
            [10, 20],
            "id,functionalci_id,contact_id",
        )

        self.assertEqual(sorted(result.keys()), [10])
        self.assertEqual(len(connector.get_calls), 2)
        self.assertIn("(contact_id = 10 OR contact_id = 20)", connector.get_calls[1][1])

    def test_unlink_contacts_from_ci_does_not_delete_missing_links(self):
        connector = FakeConnector([iTopResponse(code=0, message="OK", objects={}, raw={})])

        result = connector.unlink_contacts_from_ci(42, [10, 20])

        self.assertTrue(result.ok)
        self.assertEqual(connector.delete_calls, [])

    def test_unlink_contacts_from_ci_deletes_existing_links_from_one_read(self):
        connector = FakeConnector([
            iTopResponse(
                code=0,
                message="OK",
                objects={
                    "lnkContactToFunctionalCI::501": _relation_row(501, 10),
                    "lnkContactToFunctionalCI::502": _relation_row(502, 20),
                },
                raw={},
            )
        ])

        result = connector.unlink_contacts_from_ci(42, [10, 20])

        self.assertTrue(result.ok)
        self.assertEqual(len(connector.get_calls), 1)
        self.assertEqual([call[1] for call in connector.delete_calls], [501, 502])


if __name__ == "__main__":
    unittest.main()
