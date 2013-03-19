<?php
$date = date('m/d/Y h:i:s a', time());
print($date . "\n");

@ini_set("display_errors", "On");
@ini_set("display_startup_errors", "On");


if(!defined("TESTS_PATH"))  {
    define('TESTS_PATH', realpath(dirname(__FILE__)));
}

// some general pimcore definition overwrites
define("PIMCORE_ADMIN", true);
define("PIMCORE_DEBUG", true);
define("PIMCORE_DEVMODE", true);
define("PIMCORE_WEBSITE_VAR",  TESTS_PATH . "/tmp/var");

@mkdir(TESTS_PATH . "/output", 0777, true);

// include pimcore bootstrap
include_once(realpath(dirname(__FILE__)) . "/../pimcore/cli/startup.php");

// empty temporary var directory
recursiveDelete(PIMCORE_WEBSITE_VAR);
mkdir(PIMCORE_WEBSITE_VAR, 0777, true);

// get default configuration for the test
$testConfig = new Zend_Config_Xml(TESTS_PATH . "/config/testconfig.xml");
Zend_Registry::set("pimcore_config_test", $testConfig);
$testConfig = $testConfig->toArray();

// get configuration from main project
$systemConfigFile = realpath(dirname(__FILE__)) . "/../website/var/config/system.xml";
$systemConfig = null;
if(is_file($systemConfigFile)) {
    $systemConfig = new Zend_Config_Xml($systemConfigFile);
    $systemConfig = $systemConfig->toArray();
}

$includePathBak = get_include_path();
$includePaths = array(get_include_path());
$includePaths[] = TESTS_PATH . "/TestSuite";
array_unshift($includePaths, "/lib");
set_include_path(implode(PATH_SEPARATOR, $includePaths));

try {

    // use the default db configuration if there's no main project (eg. jenkins automated builds)
    $dbConfig = $testConfig["database"];
    if(is_array($systemConfig) && array_key_exists("database", $systemConfig)) {
        // if there's a configuration for the main project, use that one and replace the database name
        $dbConfig = $systemConfig["database"];
        $dbConfig["params"]["dbname"] = $dbConfig["params"]["dbname"] . "___phpunit";
    }

    // use mysqli for that, because Zend_Db requires a DB for a connection
    $db = new mysqli($dbConfig["params"]["host"], $dbConfig["params"]["username"], $dbConfig["params"]["password"], null, (int) $dbConfig["params"]["port"]);
    $db->query("SET NAMES utf8");

    $db->query("DROP database IF EXISTS " . $dbConfig["params"]["dbname"] . ";");
    $db->query("CREATE DATABASE " . $dbConfig["params"]["dbname"] . " charset=utf8");
}
catch (Exception $e) {
    echo $e->getMessage() . "\n";
    die("Couldn't establish connection to mysql" . "\n");
}

$setup = new Tool_Setup();
$setup->config(array(
    "database" => $dbConfig,
    "webservice" => array("enabled" => 1),
    "general" => array("validLanguages" => "en,de")
));

Pimcore::initConfiguration();

$setup->database();


$setup->contents(array(
    "username" => "admin",
    "password" => microtime()
));

// to be sure => reset the database
Pimcore_Resource::reset();

// add the tests, which still reside in the original development unit, not in pimcore_phpunit to the include path
$includePaths = array(
    get_include_path()
);

$includePaths[] = TESTS_PATH;
$includePaths[] = TESTS_PATH . "/TestSuite";
$includePaths[] = TESTS_PATH . "/lib";

set_include_path(implode(PATH_SEPARATOR, $includePaths));

// register the tests namespace
$autoloader = Zend_Loader_Autoloader::getInstance();
$autoloader->registerNamespace('Test');
$autoloader->registerNamespace('Rest');
$autoloader->registerNamespace('TestSuite');

// dummy change

/**
 * bootstrap is done, phpunit_pimcore is up and running.
 * It has a database, admin user and a complete config.
 * We can start running our tests against the phpunit_pimcore instance
 */

Pimcore_Tool_RestClient::setBaseUrl("http://" . $testConfig["rest"]["host"] . $testConfig["rest"]["base"]);
Pimcore_Tool_RestClient::setHost($testConfig["rest"]["host"]);
Pimcore_Tool_RestClient::enableTestMode();

print("include path: " . get_include_path() . "\n");
print("bootstrap    done\n");

