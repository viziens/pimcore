<?php
/**
 * Created by IntelliJ IDEA.
 * User: Michi
 * Date: 11.11.2010
 * Time: 10:35:07
 */


class TestSuite_Rest_AssetTest extends Test_Base {

    public function setUp() {
        // every single rest test assumes a clean database
        Test_Tool::cleanUp();
        parent::setUp();
    }



    public function testCreateAssetFile() {
        $this->printTestName();

        $originalContent = file_get_contents(TESTS_PATH . "/resources/assets/images/image5.jpg");

        $this->assertTrue(strlen($originalContent) > 0);

        $this->assertEquals(1, Test_Tool::getAssetCount());


        $asset = Test_Tool::createImageAsset("", $originalContent, false);
        // object not saved, asset count must still be one
        $this->assertEquals(1, Test_Tool::getAssetCount());

        $time = time();

        $result = Pimcore_Tool_RestClient::getInstance()->createAsset($asset);
        $this->assertTrue($result->id > 0, "request not successful");
        $this->assertEquals(2, Test_Tool::getAssetCount());

        $id = $result->id;
        $this->assertTrue($id > 1, "id must be greater than 1");

        $assetDirect = Asset::getById($id);
        $creationDate = $assetDirect->getCreationDate();
        $this->assertTrue($creationDate >= $time, "wrong creation date");
        $properties = $asset->getProperties();
        $this->assertEquals(1, count($properties), "property count does not match");
        $property = $properties[0];
        $this->assertEquals("bla", $property->getData());

        // as the asset key is unique there must be exactly one object with that key
        $list = Pimcore_Tool_RestClient::getInstance()->getAssetList("filename = '" . $asset->getKey() . "'");
        $this->assertEquals(1, count($list));

        // now check if the file exists
        $filename = PIMCORE_ASSET_DIRECTORY . "/" . $asset->getFilename();

        $savedContent = file_get_contents($filename);

        $this->assertEquals($originalContent, $savedContent, "asset was not saved correctly");
    }

    public function testDelete() {
        $this->printTestName();

        $originalContent = file_get_contents(TESTS_PATH . "/resources/assets/images/image5.jpg");
        $savedAsset = Test_Tool::createImageAsset("", $originalContent, true);

        $savedAsset = Asset::getById($savedAsset->getId());
        $this->assertNotNull($savedAsset);

        $response = Pimcore_Tool_RestClient::getInstance()->deleteAsset($savedAsset->getId());
        $this->assertTrue($response->success, "request wasn't successful");

        // this will wipe our local cache
        Pimcore::collectGarbage();

        $savedAsset = Asset::getById($savedAsset->getId());
        $this->assertTrue($savedAsset == null, "asset still exists");
    }

    public function testFolder() {
        $this->printTestName();

        // create folder but don't save it
        $folder = Test_Tool::createImageAsset("myfolder", null, false);
        $folder->setType("folder");

        $fitem = Asset::getById($folder->getId());
        $this->assertNull($fitem);

        $response = Pimcore_Tool_RestClient::getInstance()->createAssetFolder($folder);
        $this->assertTrue($response->id > 0, "request wasn't successful");

        $id = $response->id;
        $this->assertTrue($id > 1, "id not set");

        $folderDirect = Asset::getById($id);
        $this->assertTrue($folderDirect->getType() == "folder");

        $folderRest = Pimcore_Tool_RestClient::getInstance()->getAssetById($id);
        $this->assertTrue(Test_Tool::assetsAreEqual($folderRest, $folderDirect, false), "assets are not equal");

        Pimcore_Tool_RestClient::getInstance()->deleteAsset($id);

        Pimcore::collectGarbage();
        $folderDirect = Asset::getById($id);
        $this->assertNull($folderDirect, "folder still exists");
    }

}
