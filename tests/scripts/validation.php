<?php
$settingsFile = dirname(__DIR__, 2) . '/settings.php';
if (!file_exists($settingsFile)) {
    file_put_contents($settingsFile, "<?php\nfunction connectDb(){return null;}\n");
}
class FakeResult {
    private $rows;
    public $num_rows;
    public function __construct($rows) { $this->rows = $rows; $this->num_rows = count($rows); }
    public function fetch_assoc() { return array_shift($this->rows); }
}
class FakeStmt {
    private $rows;
    private $executeSuccess;
    public $error;
    public function __construct($rows, $execute = true, $error = '') { $this->rows = $rows; $this->executeSuccess = $execute; $this->error = $error; }
    public function bind_param($t, &$v) {}
    public function execute() { return $this->executeSuccess; }
    public function get_result() { return new FakeResult($this->rows); }
    public function close() {}
}
class FakeMysqli {
    private $stmt;
    private $prepareSuccess;
    public $error;
    public function __construct($stmt, $prepare = true, $error = '') { $this->stmt = $stmt; $this->prepareSuccess = $prepare; $this->error = $error; }
    public function prepare($sql) { if(!$this->prepareSuccess) return false; return $this->stmt; }
}
function createConnection($scenario) {
    switch($scenario) {
        case 'success': return new FakeMysqli(new FakeStmt([['pattern' => 'abc']]));
        case 'notfound': return new FakeMysqli(new FakeStmt([]));
        case 'prepareFail': return new FakeMysqli(new FakeStmt([]), false, 'prep');
        case 'executeFail': return new FakeMysqli(new FakeStmt([], false, 'exec'));
        case 'typesSuccess': return new FakeMysqli(new FakeStmt([
            ['name' => 'doi', 'pattern' => '^10\\.\\d+$', 'description' => 'd1'],
            ['name' => 'orcid', 'pattern' => '\\d{4}', 'description' => 'd2'],
        ]));
        case 'typesEmpty': return new FakeMysqli(new FakeStmt([]));
    }
}
$scenario = getenv('SCENARIO');
global $connection;
$connection = createConnection($scenario);
require dirname(__DIR__, 2) . '/api/v2/controllers/ValidationController.php';
$controller = new ValidationController();
register_shutdown_function(function () {
    $out = ob_get_clean();
    echo "OUTPUT:" . $out . "\nSTATUS:" . http_response_code() . "\n";
});
ob_start();
if (getenv('METHOD') === 'pattern') {
    $type = getenv('TYPE');
    $controller->getPattern(['type' => $type]);
} else {
    $controller->getIdentifierTypes();
}