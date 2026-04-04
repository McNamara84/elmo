<?php

declare(strict_types=1);

namespace Tests;


require_once __DIR__ . '/../save/formgroups/save_resourceinformation_and_rights.php';
require_once __DIR__ . '/../save/formgroups/save_fundingreferences.php';

final class SaveFundingreferencesTest extends DatabaseTestCase
{
    /**
     * Speicherung einer vollständigen Funding Reference inkl. Funder ID
     */
    public function testSaveCompleteFundingReferenceWithFunderId()
    {
        // 1. Zuerst alle relevanten Tabellen leeren
        $this->connection->query("SET FOREIGN_KEY_CHECKS=0");
        $this->connection->query("TRUNCATE TABLE Resource_has_Funding_Reference");
        $this->connection->query("TRUNCATE TABLE Funding_Reference");
        $this->connection->query("TRUNCATE TABLE Resource");
        $this->connection->query("SET FOREIGN_KEY_CHECKS=1");

        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.COMPLETE.FUNDING",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Complete Funding Reference"],
            "titleType" => [1]
        ];

        // 2. Resource erstellen und überprüfen
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        // Verify resource
        $stmt = $this->connection->prepare("SELECT * FROM Resource WHERE resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $resourceResult = $stmt->get_result()->fetch_assoc();

        if (!$resourceResult) {
            $this->fail("Resource creation failed");
            return;
        }

        $postData = [
            "funder" => ["Gordon and Betty Moore Foundation"],
            "funderId" => ["100000936"],
            "grantNummer" => ["GBMF3859.01"],
            "grantName" => ["Socioenvironmental Monitoring of the Amazon Basin and Xingu"],
            "awardURI" => ["https://example.com/award"]
        ];

        // 3. Funding Reference speichern
        $result = saveFundingReferences($this->connection, $postData, $resource_id);

        // 4. Funding Reference überprüfen
        $stmt = $this->connection->prepare("SELECT * FROM Funding_Reference WHERE funder = ?");
        $stmt->bind_param("s", $postData["funder"][0]);
        $stmt->execute();
        $fundingReference = $stmt->get_result()->fetch_assoc();

        if (!$fundingReference) {
            $this->fail("Funding Reference creation failed");
            return;
        }

        // 5. Verknüpfungstabelle überprüfen
        $stmt = $this->connection->prepare(
            "SELECT * FROM Resource_has_Funding_Reference 
         WHERE Resource_resource_id = ? AND Funding_Reference_funding_reference_id = ?"
        );
        $stmt->bind_param("ii", $resource_id, $fundingReference['funding_reference_id']);
        $stmt->execute();
        $relationResult = $stmt->get_result();

        if ($relationResult->num_rows === 0) {
            // Zusätzliche Überprüfung der Tabelle
            $checkStmt = $this->connection->query("SELECT * FROM Resource_has_Funding_Reference");
        }

        $relation = $relationResult->fetch_assoc();

        // 6. Assertions
        $this->assertNotNull($fundingReference, "Die Funding Reference sollte gespeichert worden sein.");
        $this->assertEquals("100000936", $fundingReference["funderid"], "Die Funder ID sollte korrekt gespeichert sein.");
        $this->assertEquals("Crossref Funder ID", $fundingReference["funderidtyp"], "Der Funder ID Type sollte 'Crossref Funder ID' sein.");
        $this->assertEquals($postData["grantNummer"][0], $fundingReference["grantnumber"]);
        $this->assertEquals($postData["grantName"][0], $fundingReference["grantname"]);
        $this->assertEquals($postData["awardURI"][0], $fundingReference["awarduri"]);
        $this->assertNotNull($relation, "Die Verknüpfung zwischen Resource und Funding Reference sollte existieren.");
    }

    /**
     * Speicherung einer vollständigen Funding Reference ohne Funder ID
     */
    public function testSaveCompleteFundingReferenceWithoutFunderId()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.COMPLETE.FUNDING.NO.ID",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Complete Funding Reference No ID"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "funder" => ["Ford Foundation"],
            "funderId" => [""],
            "grantNummer" => ["FORD123"],
            "grantName" => ["Grantmaking at a glance"],
            "awardURI" => [""]
        ];

        saveFundingReferences($this->connection, $postData, $resource_id);

        // Check if the Funding Reference was saved correctly
        $stmt = $this->connection->prepare("SELECT * FROM Funding_Reference WHERE funder = ?");
        $stmt->bind_param("s", $postData["funder"][0]);
        $stmt->execute();
        $fundingReference = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($fundingReference, "Die Funding Reference sollte gespeichert worden sein.");
        $this->assertNull($fundingReference["funderid"], "Die Funder ID sollte null sein.");
        $this->assertNull($fundingReference["funderidtyp"], "Der Funder ID Type sollte null sein.");
        $this->assertEquals($postData["grantNummer"][0], $fundingReference["grantnumber"]);
        $this->assertEquals($postData["grantName"][0], $fundingReference["grantname"]);

        // Check if the relation to the resource was created
        $stmt = $this->connection->prepare("SELECT * FROM Resource_has_Funding_Reference WHERE Resource_resource_id = ? AND Funding_Reference_funding_reference_id = ?");
        $stmt->bind_param("ii", $resource_id, $fundingReference["funding_reference_id"]);
        $stmt->execute();
        $relation = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($relation, "Die Verknüpfung zwischen Resource und Funding Reference sollte existieren.");
    }

    /**
     * Versuch, eine Funding Reference ohne Pflichtfelder zu speichern
     */
    public function testSaveIncompleteFundingReference()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.INCOMPLETE.FUNDING",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Incomplete Funding Reference"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "funder" => [""],
            "funderId" => [""],
            "grantNummer" => ["INCOMPLETE123"],
            "grantName" => ["Incomplete Grant"],
            "awardURI" => [""]
        ];

        $result = saveFundingReferences($this->connection, $postData, $resource_id);

        $this->assertFalse($result, "Die Funktion sollte false zurückgeben.");

        // Check that no Funding Reference was saved
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Funding_Reference");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, "Es sollten keine Funding References gespeichert worden sein.");
    }

    /**
     * Versuch, eine Funding Reference nur mit Award URI zu speichern
     */
    public function testSaveAwardUriWithoutFunder()
    {
        $resource_id = $this->createResource('GFZ.TEST.AWARD.NO.FUNDER', 'Test Award URI Without Funder');

        $postData = [
            'funder' => [''],
            'funderId' => [''],
            'grantNummer' => [''],
            'grantName' => [''],
            'awardURI' => ['https://example.com/award']
        ];

        $result = saveFundingReferences($this->connection, $postData, $resource_id);

        $this->assertFalse($result, 'Die Funktion sollte false zurückgeben.');

        $stmt = $this->connection->prepare('SELECT COUNT(*) as count FROM Funding_Reference');
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, 'Es sollten keine Funding References gespeichert worden sein.');
    }

    /**
     * Speicherung von zwei vollständigen und einer unvollständigen Funding Reference
     */
    public function testSaveMixedFundingReferences()
    {
        $resourceData = [
            "doi" => "10.5880/GFZ.TEST.MIXED.FUNDING",
            "year" => 2023,
            "dateCreated" => "2023-06-01",
            "resourcetype" => 1,
            "language" => 1,
            "Rights" => 1,
            "title" => ["Test Mixed Funding References"],
            "titleType" => [1]
        ];
        $resource_id = saveResourceInformationAndRights($this->connection, $resourceData);

        $postData = [
            "funder" => ["Gordon and Betty Moore Foundation", "", "Ford Foundation"],
            "funderId" => ["https://doi.org/10.13039/100000936", "", ""],
            "grantNummer" => ["GBMF3859.01", "INCOMPLETE123", "FORD123"],
            "grantName" => ["Socioenvironmental Monitoring", "Incomplete Grant", "Grantmaking at a glance"],
            "awardURI" => ["https://example.com/award1", "", ""]
        ];

        saveFundingReferences($this->connection, $postData, $resource_id);

        // Check that only two Funding References were saved
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Funding_Reference");
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(2, $count, "Es sollten genau zwei Funding References gespeichert worden sein.");

        // Check that only two relations to the resource were created
        $stmt = $this->connection->prepare("SELECT COUNT(*) as count FROM Resource_has_Funding_Reference WHERE Resource_resource_id = ?");
        $stmt->bind_param("i", $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(2, $count, "Es sollten genau zwei Verknüpfungen zwischen Resource und Funding Reference existieren.");

        // Check that the correct Funding References were saved
        $stmt = $this->connection->prepare("SELECT funder FROM Funding_Reference");
        $stmt->execute();
        $result = $stmt->get_result();
        $savedFunders = [];
        while ($row = $result->fetch_assoc()) {
            $savedFunders[] = $row['funder'];
        }

        $this->assertContains("Gordon and Betty Moore Foundation", $savedFunders, "Die erste vollständige Funding Reference sollte gespeichert worden sein.");
        $this->assertContains("Ford Foundation", $savedFunders, "Die dritte vollständige Funding Reference sollte gespeichert worden sein.");
        $this->assertNotContains("", $savedFunders, "Die unvollständige Funding Reference sollte nicht gespeichert worden sein.");
    }

    public function testSaveNoFundingReferenceData()
    {
        $resource_id = $this->createResource('GFZ.TEST.NO.FUNDING', 'Test No Funding');

        $result = saveFundingReferences($this->connection, [], $resource_id);

        $this->assertTrue($result, 'Die Funktion sollte true zurückgeben, wenn keine Daten vorhanden sind.');

        $stmt = $this->connection->prepare('SELECT COUNT(*) as count FROM Funding_Reference');
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, 'Es sollten keine Funding References gespeichert worden sein.');
    }

    public function testSaveFundingReferenceInvalidResourceId()
    {
        $postData = [
            'funder' => ['Invalid Foundation'],
            'funderId' => ['1234567890'],
            'grantNummer' => ['INV-1'],
            'grantName' => ['Invalid Case'],
            'awardURI' => ['https://example.com/invalid']
        ];

        $result = saveFundingReferences($this->connection, $postData, 0);

        $this->assertFalse($result, 'Die Funktion sollte false bei ungültiger Resource ID zurückgeben.');

        $stmt = $this->connection->prepare('SELECT COUNT(*) as count FROM Funding_Reference');
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(0, $count, 'Es sollten keine Funding References gespeichert werden.');
    }

    public function testSaveDuplicateFundingReference()
    {
        $resource_id = $this->createResource('GFZ.TEST.DUPLICATE.FUNDING', 'Test Duplicate Funding');

        $postData = [
            'funder' => ['Dup Foundation', 'Dup Foundation'],
            'funderId' => ['https://doi.org/10.13039/100000936', 'https://doi.org/10.13039/100000936'],
            'grantNummer' => ['DUP-1', 'DUP-1'],
            'grantName' => ['Duplicate Grant', 'Duplicate Grant'],
            'awardURI' => ['https://example.com/dup', 'https://example.com/dup']
        ];

        saveFundingReferences($this->connection, $postData, $resource_id);

        $stmt = $this->connection->prepare('SELECT COUNT(*) as count FROM Funding_Reference');
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(1, $count, 'Es sollte nur eine Funding Reference gespeichert werden.');

        $stmt = $this->connection->prepare('SELECT COUNT(*) as count FROM Resource_has_Funding_Reference WHERE Resource_resource_id = ?');
        $stmt->bind_param('i', $resource_id);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(1, $count, 'Es sollte nur eine Verknüpfung zwischen Resource und Funding Reference existieren.');
    }

    /**
     * Saving a Funding Reference with ROR ID
     */
    public function testSaveFundingReferenceWithRorId()
    {
        $resource_id = $this->createResource('GFZ.TEST.ROR.FUNDING', 'Test ROR Funding Reference');

        $postData = [
            'funder' => ['Helmholtz Centre Potsdam GFZ'],
            'funderId' => ['https://ror.org/04z8jg394'],
            'funderidtyp' => ['ROR'],
            'grantNummer' => ['ROR-GRANT-001'],
            'grantName' => ['ROR Test Grant'],
            'awardURI' => ['https://example.com/ror-award']
        ];

        $result = saveFundingReferences($this->connection, $postData, $resource_id);

        $this->assertTrue($result, 'The function should return true.');

        $stmt = $this->connection->prepare('SELECT * FROM Funding_Reference WHERE funder = ?');
        $stmt->bind_param('s', $postData['funder'][0]);
        $stmt->execute();
        $fundingReference = $stmt->get_result()->fetch_assoc();

        $this->assertNotNull($fundingReference, 'The Funding Reference should have been saved.');
        $this->assertEquals('https://ror.org/04z8jg394', $fundingReference['funderid'], 'The ROR ID should be stored as a full URL.');
        $this->assertEquals('ROR', $fundingReference['funderidtyp'], 'The Funder ID Type should be ROR.');
        $this->assertEquals($postData['grantNummer'][0], $fundingReference['grantnumber']);
        $this->assertEquals($postData['grantName'][0], $fundingReference['grantname']);
        $this->assertEquals($postData['awardURI'][0], $fundingReference['awarduri']);
    }

    /**
     * Tests prepareFunderIdDetails with ROR funder ID type
     */
    public function testPrepareFunderIdDetailsWithRor()
    {
        [$funderIdString, $funderIdType] = prepareFunderIdDetails('https://ror.org/04z8jg394', 'ROR');

        $this->assertEquals('https://ror.org/04z8jg394', $funderIdString, 'ROR ID should be stored unchanged as a full URL.');
        $this->assertEquals('ROR', $funderIdType, 'Funder ID Type should be ROR.');
    }

    /**
     * Tests prepareFunderIdDetails with Crossref funder ID type (default)
     */
    public function testPrepareFunderIdDetailsWithCrossref()
    {
        [$funderIdString, $funderIdType] = prepareFunderIdDetails('100000936', 'crossref');

        $this->assertEquals('100000936', $funderIdString, 'Crossref ID should be extracted as last 10 digits.');
        $this->assertEquals('Crossref Funder ID', $funderIdType, 'Funder ID Type should be Crossref Funder ID.');
    }

    /**
     * Tests prepareFunderIdDetails with empty funder ID
     */
    public function testPrepareFunderIdDetailsWithEmptyId()
    {
        [$funderIdString, $funderIdType] = prepareFunderIdDetails('', 'ROR');

        $this->assertNull($funderIdString, 'Empty Funder ID should return null.');
        $this->assertNull($funderIdType, 'Empty Funder ID should return null for the type.');
    }

    /**
     * Saving mixed Funding References with Crossref and ROR
     */
    public function testSaveMixedCrossrefAndRorFundingReferences()
    {
        $resource_id = $this->createResource('GFZ.TEST.MIXED.PID', 'Test Mixed PID Funding');

        $postData = [
            'funder' => ['National Science Foundation', 'Helmholtz Centre Potsdam GFZ'],
            'funderId' => ['100000001', 'https://ror.org/04z8jg394'],
            'funderidtyp' => ['crossref', 'ROR'],
            'grantNummer' => ['NSF-001', 'GFZ-001'],
            'grantName' => ['NSF Grant', 'GFZ Grant'],
            'awardURI' => ['https://example.com/nsf', 'https://example.com/gfz']
        ];

        $result = saveFundingReferences($this->connection, $postData, $resource_id);

        $this->assertTrue($result, 'The function should return true.');

        $stmt = $this->connection->prepare('SELECT * FROM Funding_Reference ORDER BY funding_reference_id ASC');
        $stmt->execute();
        $result = $stmt->get_result();
        $references = [];
        while ($row = $result->fetch_assoc()) {
            $references[] = $row;
        }

        $this->assertCount(2, $references, 'Exactly two Funding References should have been saved.');

        // Crossref entry
        $this->assertEquals('Crossref Funder ID', $references[0]['funderidtyp']);
        $this->assertEquals('100000001', $references[0]['funderid']);

        // ROR entry
        $this->assertEquals('ROR', $references[1]['funderidtyp']);
        $this->assertEquals('https://ror.org/04z8jg394', $references[1]['funderid']);
    }

    /**
     * Bug #767: Duplicate funding references when ALL optional fields are NULL.
     */
    public function testSaveDuplicateFundingReferenceWithNullFields()
    {
        $resource_id = $this->createResource('GFZ.TEST.DUPLICATE.NULL', 'Test Duplicate NULL Funding');

        $postData = [
            'funder' => ['Only Funder Name', 'Only Funder Name'],
            'funderId' => ['', ''],
            'grantNummer' => ['', ''],
            'grantName' => ['', ''],
            'awardURI' => ['', '']
        ];

        saveFundingReferences($this->connection, $postData, $resource_id);

        $stmt = $this->connection->prepare('SELECT COUNT(*) as count FROM Funding_Reference WHERE funder = ?');
        $funder = 'Only Funder Name';
        $stmt->bind_param('s', $funder);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(1, $count, 'Bug #767: Duplicate funding reference created when all optional fields are NULL.');
    }

    /**
     * Bug #767: Duplicate detection when only awardUri is NULL but other fields are filled.
     */
    public function testSaveDuplicateFundingReferenceWithPartialNullFields()
    {
        $resource_id = $this->createResource('GFZ.TEST.PARTIAL.NULL', 'Test Partial NULL Funding');

        $postData = [
            'funder' => ['Partial Funder', 'Partial Funder'],
            'funderId' => ['https://doi.org/10.13039/100000001', 'https://doi.org/10.13039/100000001'],
            'grantNummer' => ['GRANT-123', 'GRANT-123'],
            'grantName' => ['Test Grant', 'Test Grant'],
            'awardURI' => ['', '']
        ];

        saveFundingReferences($this->connection, $postData, $resource_id);

        $stmt = $this->connection->prepare('SELECT COUNT(*) as count FROM Funding_Reference WHERE funder = ?');
        $funder = 'Partial Funder';
        $stmt->bind_param('s', $funder);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(1, $count, 'Bug #767: Duplicate created when only awardUri is NULL.');
    }

    /**
     * Bug #767: Entries that differ only in a nullable field should NOT be considered duplicates.
     */
    public function testDifferentFundingReferencesWithOneNullFieldAreNotDuplicates()
    {
        $resource_id = $this->createResource('GFZ.TEST.DIFFER.NULL', 'Test Different NULL Funding');

        $postData = [
            'funder' => ['Same Funder', 'Same Funder'],
            'funderId' => ['', ''],
            'grantNummer' => ['GRANT-A', ''],
            'grantName' => ['', ''],
            'awardURI' => ['', '']
        ];

        saveFundingReferences($this->connection, $postData, $resource_id);

        $stmt = $this->connection->prepare('SELECT COUNT(*) as count FROM Funding_Reference WHERE funder = ?');
        $funder = 'Same Funder';
        $stmt->bind_param('s', $funder);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(2, $count, 'Funding references with different grant numbers should be stored separately.');
    }

    /**
     * Bug #767: Saving the same funding reference across two resources should reuse the same row.
     */
    public function testSaveSameFundingReferenceWithNullFieldsAcrossResources()
    {
        $resource_id_1 = $this->createResource('GFZ.TEST.RES1.NULL', 'Test Resource 1 NULL');
        $resource_id_2 = $this->createResource('GFZ.TEST.RES2.NULL', 'Test Resource 2 NULL');

        $postData = [
            'funder' => ['Cross Resource Funder'],
            'funderId' => [''],
            'grantNummer' => [''],
            'grantName' => [''],
            'awardURI' => ['']
        ];

        saveFundingReferences($this->connection, $postData, $resource_id_1);
        saveFundingReferences($this->connection, $postData, $resource_id_2);

        $stmt = $this->connection->prepare('SELECT COUNT(*) as count FROM Funding_Reference WHERE funder = ?');
        $funder = 'Cross Resource Funder';
        $stmt->bind_param('s', $funder);
        $stmt->execute();
        $count = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(1, $count, 'Bug #767: Same funding reference with NULL fields should be reused across resources.');

        $stmt = $this->connection->prepare(
            'SELECT COUNT(*) as count FROM Resource_has_Funding_Reference rhf
             JOIN Funding_Reference fr ON fr.funding_reference_id = rhf.Funding_Reference_funding_reference_id
             WHERE fr.funder = ?'
        );
        $stmt->bind_param('s', $funder);
        $stmt->execute();
        $linkCount = $stmt->get_result()->fetch_assoc()['count'];

        $this->assertEquals(2, $linkCount, 'The single funding reference should be linked to both resources.');
    }
}