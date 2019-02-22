const { MysqlRedis, MysqlRedisAsync, Caching, HashTypes } = require("../index");

// to run this
// test create a mysql test_user with password test_user, you do not need to grant anything to this user
// start mysql and redis server
/*


> npm run test 

Example results: 

MysqlRedisAsync - 83 ms
    should return results from redis - 2 ms
    should skip redis and get result from mysql - 1 ms
    should get result from mysql and refresh redis - 0 ms
    should return results from redis - 28 ms
    should skip redis and get result from mysql - 12 ms
    should get result from mysql and refresh redis - 11 ms
    should return results from redis for blake2b512 - 1 ms
    should return results from redis for farmhash64 - 13 ms
    should return results from redis for full - 14 ms

MysqlRedis - 104 ms
    should return results from redis - 14 ms
    should skip redis and get result from mysql - 10 ms
    should get result from mysql and refresh redis - 11 ms
    should return results from redis - 12 ms
    should skip redis and get result from mysql - 11 ms
    should get result from mysql and refresh redis - 11 ms
    should return results from redis for blake2b512 - 12 ms
    should return results from redis for farmhash64 - 11 ms
    should return results from redis for full - 11 ms

Finished in 0.191 seconds
18 tests, 18 assertions, 0 failures, 0 skipped

*/
const redisOptions = { host: "127.0.0.1", port: 6379 };
const mysqlOptions = {
    host: "127.0.0.1",
    port: 3306,
    user: "test_user",
    password: "test_user",
    supportBigNumbers: true,
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0
};

const mysql = require("mysql2");
const pool = mysql.createPool(mysqlOptions);
const poolAsync = pool.promise();

const Redis = require("redis");
const redisConnection = Redis.createClient(redisOptions);

const asyncRedis = require("async-redis");
const redisConnectionAsync = asyncRedis.createClient(redisOptions);

const cacheOptions = {
    expiry: 2629746, // seconds, defaults to 30 days
    keyPrefix: "test.sql.", // default
    hashType: HashTypes.farmhash32 //default
};

const mysqlRedisAsync = new MysqlRedisAsync(
    poolAsync,
    redisConnectionAsync,
    cacheOptions
);
const mysqlRedis = new MysqlRedis(pool, redisConnection, cacheOptions);

// set caches
mysqlRedisAsync.query("select 1+?", [2], { expire: 100 }).then(() => {});
mysqlRedisAsync.query("select 1+2", { expire: 100 }).then(() => {});
mysqlRedisAsync
    .query("select 1+?", [2], {
        expire: 100,
        hashType: HashTypes.blake2b512
    })
    .then(() => {});
mysqlRedisAsync
    .query("select 1+2", {
        expire: 100,
        hashType: HashTypes.blake2b512
    })
    .then(() => {});
mysqlRedisAsync
    .query("select 1+2", {
        expire: 100,
        hashType: HashTypes.full
    })
    .then(() => {});

mysqlRedisAsync
    .query("select 1+2", {
        expire: 100,
        hashType: HashTypes.farmhash64
    })
    .then(() => {});
mysqlRedisAsync
    .query("select 1+2", {
        expire: 100,
        hashType: HashTypes.full
    })
    .then(() => {});

// *** set cache ***

describe("MysqlRedisAsync", () => {
    it("should return results from redis", done => {
        mysqlRedis.query(
            "select 1+?",
            [2],
            {
                expire: 100
            },
            (err, result, fields) => {
                expect(JSON.stringify(result) === '[{"1+2":3}]');

                expect(fields[0].cacheHit).toEqual("test.sql.DiHlF3yv0V$");
            }
        );

        done();
    });

    it("should skip redis and get result from mysql", done => {
        mysqlRedisAsync
            .query("select 1+?", [2], { expire: 100, caching: Caching.SKIP })
            .then(([result, fields]) => {
                expect(JSON.stringify(result) === '[{"1+2":3}]');

                expect(fields[0].cacheHit).toBeUndefined();
            });
        done();
    });
    //
    it("should get result from mysql and refresh redis", done => {
        mysqlRedisAsync
            .query("select 1+?", [2], { expire: 100, caching: Caching.REFRESH })
            .then(([result, fields]) => {
                expect(JSON.stringify(result) === '[{"1+2":3}]');
                expect(fields[0].cacheHit).toBeUndefined();
            });
        done();
    });
    it("should return results from redis", done => {
        mysqlRedisAsync
            .query("select 1+2", { expire: 100 })
            .then(([result, fields], err) => {
                if (err) console.log(err);
                expect(JSON.stringify(result) === '[{"1+2":3}]');
                expect(fields[0].cacheHit).toEqual("test.sql.BzH09y5Ps$$");
                done();
            });
    });
    //
    it("should skip redis and get result from mysql", done => {
        mysqlRedisAsync
            .query("select 1+2", { expire: 100, caching: Caching.SKIP })
            .then(([result, fields]) => {
                expect(JSON.stringify(result) === '[{"1+2":3}]');
                expect(fields[0].cacheHit).toBeUndefined();
                done();
            });
    });
    //
    it("should get result from mysql and refresh redis", done => {
        mysqlRedisAsync
            .query("select 1+2", { expire: 100, caching: Caching.REFRESH })
            .then(([result, fields]) => {
                expect(JSON.stringify(result) === '[{"1+2":3}]');
                expect(fields[0].cacheHit).toBeUndefined();
                done();
            });
    });

    it("should return results from redis for blake2b512", () => {
        mysqlRedisAsync
            .query("select 1+2", {
                expire: 100,
                hashType: HashTypes.blake2b512
            })
            .then(([result, fields], err) => {
                if (err) console.log(err);

                expect(JSON.stringify(result) === '[{"1+2":3}]');
                expect(fields[0].cacheHit).toEqual(
                    "test.sql.pTsj9nLv962nE0Zgi54WW0ZW+MzA0F7yDSaR4N2gKBqOlM3XgCpdwJLbAsU9d2BNZ9Y4Du3MqyxnpaCh8sd5aw=="
                );
            });
    });
    //
    it("should return results from redis for farmhash64", done => {
        mysqlRedisAsync
            .query("select 1+2", {
                expire: 100,
                hashType: HashTypes.farmhash64
            })
            .then(([result, fields], err) => {
                if (err) console.log(err);
                expect(JSON.stringify(result) === '[{"1+2":3}]');
                expect(fields[0].cacheHit).toEqual("test.sql.2lVUhW");
                done();
            });
    });
    it("should return results from redis for full", async done => {
        const [result, fields] = await mysqlRedisAsync.query("select 1+2", {
            expire: 100,
            hashType: HashTypes.full
        });
        expect(fields[0].cacheHit).toEqual(
            'test.sql.select 1+2{"expire":100,"hashType":3}'
        );
        expect(JSON.stringify(result) === '[{"1+2":3}]');
        done();
    });
});

describe("MysqlRedis", () => {
    //    beforeEach(function(done) {
    //        setTimeout(function() {
    //            //value = 0;
    //            done();
    //        }, 100);
    //    });
    //
    it("should return results from redis", done => {
        mysqlRedis.query(
            "select 1+?",
            [2],
            {
                expire: 100
            },
            (err, result, fields) => {
                expect(JSON.stringify(result) === '[{"1+2":3}]');
                expect(fields[0].cacheHit).toEqual("test.sql.DiHlF3yv0V$");

                done();
            }
        );
    });

    it("should skip redis and get result from mysql", done => {
        mysqlRedis.query(
            "select 1+?",
            [2],
            { expire: 100, caching: Caching.SKIP },
            (err, result, fields) => {
                expect(JSON.stringify(result) === '[{"1+2":3}]');

                expect(fields[0].cacheHit).toBeUndefined();
                done();
            }
        );
    });
    //    //
    it("should get result from mysql and refresh redis", done => {
        mysqlRedis.query(
            "select 1+?",
            [2],
            { expire: 100, caching: Caching.REFRESH },
            (err, result, fields) => {
                expect(JSON.stringify(result) === '[{"1+2":3}]');
                expect(fields[0].cacheHit).toBeUndefined();
                done();
            }
        );
    });
    it("should return results from redis", done => {
        mysqlRedis.query(
            "select 1+2",
            { expire: 100 },
            (err, result, fields) => {
                if (err) console.log(err);
                expect(JSON.stringify(result) === '[{"1+2":3}]');
                expect(fields[0].cacheHit).toEqual("test.sql.BzH09y5Ps$$");
                done();
            }
        );
    });
    //    //
    it("should skip redis and get result from mysql", done => {
        mysqlRedis.query(
            "select 1+2",
            { expire: 100, caching: Caching.SKIP },
            (err, result, fields) => {
                expect(JSON.stringify(result) === '[{"1+2":3}]');
                expect(fields[0].cacheHit).toBeUndefined();
                done();
            }
        );
    });
    //    //
    it("should get result from mysql and refresh redis", done => {
        mysqlRedis.query(
            "select 1+2",
            { expire: 100, caching: Caching.REFRESH },
            (err, result, fields) => {
                expect(JSON.stringify(result) === '[{"1+2":3}]');
                expect(fields[0].cacheHit).toBeUndefined();
                done();
            }
        );
    });
    //
    it("should return results from redis for blake2b512", done => {
        mysqlRedis.query(
            "select 1+2",
            {
                expire: 100,
                hashType: HashTypes.blake2b512
            },
            (err, result, fields) => {
                if (err) console.log(err);

                expect(JSON.stringify(result) === '[{"1+2":3}]');
                expect(fields[0].cacheHit).toEqual(
                    "test.sql.pTsj9nLv962nE0Zgi54WW0ZW+MzA0F7yDSaR4N2gKBqOlM3XgCpdwJLbAsU9d2BNZ9Y4Du3MqyxnpaCh8sd5aw=="
                );
                done();
            }
        );
    });
    //    //
    it("should return results from redis for farmhash64", done => {
        mysqlRedis.query(
            "select 1+2",
            {
                expire: 100,
                hashType: HashTypes.farmhash64
            },
            (err, result, fields) => {
                if (err) console.log(err);
                expect(JSON.stringify(result) === '[{"1+2":3}]');
                expect(fields[0].cacheHit).toEqual("test.sql.2lVUhW");
                done();
            }
        );
    });
    it("should return results from redis for full", async done => {
        mysqlRedis.query(
            "select 1+2",
            {
                expire: 100,
                hashType: HashTypes.full
            },
            (err, result, fields) => {
                expect(fields[0].cacheHit).toEqual(
                    'test.sql.select 1+2{"expire":100,"hashType":3}'
                );
                expect(JSON.stringify(result) === '[{"1+2":3}]');
                done();
            }
        );
    });
});
