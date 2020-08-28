# mysql-redis :rocket:

Transform your mysql server with `Redis` caching layer for [mysql](https://www.npmjs.com/package/mysql)/[mysql2](https://www.npmjs.com/package/mysql2).

- MysqlRedis checks if there is a cached result for the query in redis
- if not found in cache, it will retrieve data from mysql and on successful result cache it in redis for future queries
- if redis is unavailable or errors, query will be served by mysql

## Use-case

Use _along_ with mysql and redis. This is not a replacement of either. Use it with queries/stored procedures that only perform `select` and will return same result set every time.

- **No brainer** for retrieving static data, eg, `select * from countries`
- Data that will not be updated once created, typically timeseries data like chat messages, logs
- Use with caution where data may get updated in mysql as redis cache may be stale

### Hashing

The above is achieved by creating a unique hash for every query

    "select 1+2" => #️⃣

In redis, the hash and query results are stored as key-value pair

    #️⃣ => [{'1+2':3}]

#### Currently supported hash types are:

**farmhash32** ⚡🗜️
Example redis key: _prefix._`2jNDCJ`
Fast!!! Over ~5 million hashes/s on reference machine. Most compact key. (if you have millions of possible queries, these hashes can collide :collision:)

**farmhash64**
Example redis key: _prefix._`DiHlF3yv0V$`
fast (~2 million hashes/sec on reference machine )
_farmhash32/64_ use Google's farmhash, non-crypto algorithm (if you have millions of possible queries, these hashes can collide :collision:)

**blake2b512** 🛡️
Example redis key: _prefix._`4KbMOx3xJi+7mJNy0tDbju6NY9uHqOroDsG4rYjpHK1mEwXJokls5Ofdjs7iDsn3cAtibgUkT8RDdpCE2phhiQ==`
Crypto safe, ~500k hashes/sec on reference machine.
Use it for caching millions of different queries (eg. chats, logs)
Note that the key is longer than farmhash32/64.

**full**
Matches full query string. Use this if you are paranoid or if your queries are smaller than blake2b512 hashes

Or you can **provide your own hash _per_ query**, eg, _prefix._`p.123` to represent `select * from person p where id = 123`

## Getting Started

### Pre-Requisites

mysql ([mysql](https://www.npmjs.com/package/mysql)/[mysql2](https://www.npmjs.com/package/mysql2)), and redis ([redis](https://www.npmjs.com/package/redis)/[ioredis](https://www.npmjs.com/package/ioredis)). Internally MysqlRedis relies on mysql/mysql2's `query` function and redis's `get` and `set` functions

For async/await api, you can use mysql2's promise api and [async-redis](https://www.npmjs.com/package/async-redis)

### Installing

`npm i mysql-redis --save`

If farmhash complains _No prebuilt binaries found_, then first build farmhash from source (you will need platform build tools)
`npm install farmhash --build-from-source`

### Usage

```
const { MysqlRedis, HashTypes, Caching } = require("mysql-redis");

// or if you use async await api
const { MysqlRedisAsync, HashTypes, Caching } = require("mysql-redis");
```

#### Creating an instance of MysqlRedis requires

- a mysql connection or pool (mysqlRedis will call it's query method when no cache found)
- redis connection (mysqlRedis will call its set and get methods)
- cache options (optional)

#### Creating an instance of MysqlRedisAsync requires

- a mysql connection or pool promise
  ```
  // Example from mysql2 docs:
  const  poolPromise  =  mysql.createPool({
                                    host:'localhost',
                                    user:  'root',
                                    database:  'test'
                                })
                                .promise();
  ```
- async redis

  ```
  eg:
  const  asyncRedis  =  require("async-redis");
  const  redis  =  asyncRedis.createClient(redisOptions);

  ```

- cache options (optional)

import `HashTypes` and `Caching` from mysql-redis

```
const cacheOptions = {
    expiry: 2629746,// seconds, defaults to 30 days
    keyPrefix: "sql.", // default
    hashType: HashTypes.farmhash32 //default
    caching: Caching.CACHE //default
};
```

`hashType` can be

- `HashTypes.farmhash32`
- `HashTypes.farmhash64`
- `HashTypes.blake2b512`
- `HashTypes.full`

`caching` can be

- `Caching.CACHE` to get data from Redis if available, else mysql
- `Caching.SKIP` to get data from mysql, do not save to redis
- `Caching.REFRESH` to get data from mysql and save to redis

Options can be specified when creating mysqlRedis instance or overriden at the time of query.
At query time, you can also provide a custom hash as _cacheOptions.hash_ (ignores hashType if specified)

```
const mysqlRedis = new MysqlRedis(
    mysqlConnection,
    redisConnection,
    cacheOptions
);
```

Now if you wish to get something from cache, just use mysqlRedis.query instead of your mysql connection's query. (Use your mysql connection normally to bypass cache)

```
mysqlRedis.query('select * from logs where id =?",["some-log-id"], (err,data,fields)=>{
	console.log(data)
	// if served by Redis, fields value is something like [ { cacheHit: 'sql.Dh9VSNbN5V$' } ]
	// else mysql fields
});
```

or if you like promises, then:

```
const mysqlRedis = new MysqlRedisAsync(
    mysqlConnection,
    redisConnection,
    cacheOptions
);

... in an async function ...
try{

	[result,fields]=await mysqlRedis.query("select 1+?+?",[2,3]);

}catch(err){
	// handle err
}

```

You can override cache options per query as below:

```
mysqlRedis.query('select * from logs where id =?",["some-log-id"],
	{ //cache option
		keyPrefix:'sql-abc-',
		expire:3600,
		hashType: HashTypes.farmhash64
        //or hash: myHash <- provide your own
        // caching: Caching.SKIP or Caching.REFRESH or Caching.CACHE
	},
	(err,data,fields)=>{
	console.log(data)
	// if served by Redis, fields value is something like [ { cacheHit: 'sql.Dh9VSNbN5V$' } ]
	// else mysql fields
});


// promise api
[result,fields]=await mysqlRedis.query("select 1+?+?",[2,3],
   { //cache option
		keyPrefix:'sql-abc-',
		expire:3600,
		hashType: HashTypes.farmhash64
        //or hash: myHash <- provide your own
        // caching: Caching.SKIP or Caching.REFRESH or Caching.CACHE
	});

```

## Testing

- Start mysql and redis servers on your local (host 127.0.0.1, default ports)
- create user `test_user` with password `test_user` in mysql, no need to give any grants
- then run

`npm run test `

## Contributing

Feel free to fork/send PR

## Authors

- **Gi Singh**

## License

This project is licensed under the [MIT](./LICENSE).
