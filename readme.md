

# mysql-redis

Transform your mysql server with Redis caching layer for mysql/mysql2. MysqlRedis check if there is a recently cached result for the query in redis, if not, it will retrieve data from mysql and cache it in redis for future queries

### Use-case
Use _along_ with mysql and redis

- **No brainer** for retrieving static data, eg, `select * from countries`
- Useful for data that will not be updated once created, eg, `select message from chat where id=?`
- Do not use/Use with caution where data may get updated in mysql as redis cache may be stale
- Use it only with queries/stored procedures that will only select

## Getting Started

### Pre-Requisites
mysql or mysql2, and redis.

For async/await api, you can use mysql2's promise api and [redis-async](https://www.npmjs.com/package/mysql-redis)

### Installing
`npm i mysql-redis --save` 

### Usage
```
const { MysqlRedis } = require("./mysql-redis");

// or if you use async await api
const { MqlRedisAsync } = require("./mysql-redis");
```

####  Creating an instance of MysqlRedis requires 
- a mysql connection or pool (mysqlRedis will call it's query method when no cache found)
- redis connection (mysqlRedis will call its set and get methods)
- cache options (optional)  

####  Creating an instance of MysqlRedisAsync requires 
- a mysql connection or pool promise 
	``` 
	// Example
	const  poolPromise  =  mysql.createPool({host:'localhost', user:  'root', database:  'test'}).promise();
	```
- redis async 
	```
	eg:
	const  asyncRedis  =  require("async-redis");
	const  redis  =  asyncRedis.createClient(redisOptions);

	```
- cache options (optional)  

```
const cacheOptions = {
    expiry: 2629746,// seconds, defaults to 30 days 
    keyPrefix: "sql." // default
};

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

...
try{

	[result,fields]=await mysqlRedis.query("select 1+?+?",[2,3]);

}catch(err){
	// handle err
}

```
if you want to specify different keyPrefix or different expire/TTL per query, then provide it as option object as 

```
mysqlRedis.query('select * from logs where id =?",["some-log-id"],{ keyPrefix:'sql-abc-', expire:3600 }, (err,data,fields)=>{
	console.log(data)
	// if served by Redis, fields value is something like [ { cacheHit: 'sql.Dh9VSNbN5V$' } ]
	// else mysql fields
});


// promise api
[result,fields]=await mysqlRedis.query("select 1+?+?",[2,3],{ keyPrefix:'your-preferred-prefix-', expire:3600 });

```

 
## Contributing

 Feel free to fork/send PR

## Authors

* **Gi Singh** 

## License

This project is licensed under the [MIT](./LICENSE).

