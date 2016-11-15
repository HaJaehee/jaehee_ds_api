

# EPCIS Access Control API Server
Version 2.0.0 <br/>
2016.11.14<br/>


## Features
OAuth 2.0 is applied.<br/>
Token based access control is applied.<br/>
EPCIS management is implemented.<br/>
Individual Role Based Access Control for EPCIS Access Authorization is implemented.<br/>
Group management is implemented.<br/>
Group Role Based Access Control for EPCIS Access Authorization is implemented.<br/>


## Usage
First of all, please configure the conf.json file.<br/>
This program works with [EPCIS Access Control Server](https://github.com/HaJaehee/jaehee_epcis_ac),<br/>
and [EPCIS](https://github.com/woosungpil/epcis/tree/cs632_project).<br/>


## Developing
Jaehee Ha implemented EPCIS Access Control API Server.<br/>
EPCIS Access Control API Server is based on DiscoveryService Access Control API Server.<br/>
email: lovesm135@kaist.ac.kr<br/>




### Tools
Created with [Nodeclipse](https://github.com/Nodeclipse/nodeclipse-1)<br/>
 ([Eclipse Marketplace](http://marketplace.eclipse.org/content/nodeclipse), [site](http://www.nodeclipse.org))   <br/>

Nodeclipse is free open-source project that grows with your contributions.<br/>


### Databases
[Neo4j] (https://neo4j.com/)<br/>
[PostgreSQL] (https://www.postgresql.org/)<br/>

### DB schema

#### PostgreSQL Console
Server [localhost]: localhost<br/>
Database [postgres]: epcis_ac<br/>
Port [5432]: 5432<br/>
Username [postgres]: postgres<br/>
Password for user postgres: password<br/>
psql (9.6.0)<br/>
Type "help" for help.<br/>

epcis_ac=# CREATE TABLE oauth_access_tokens(access_token text,client_id text,expires timestamp,user_id text);<br/>
CREATE TABLE<br/>
epcis_ac=# CREATE TABLE oauth_clients(client_id text,client_secret text,redirect_uri text);<br/>
CREATE TABLE<br/>
epcis_ac=# CREATE TABLE oauth_refresh_tokens(refresh_token text,client_id text,expires timestamp,user_id text);<br/>
CREATE TABLE<br/>
epcis_ac=# CREATE TABLE users(id uuid,username text,groupname text,password text);<br/>
CREATE TABLE<br/>
epcis_ac=# CREATE EXTENSION IF NOT EXISTS "pgcrypto";<br/>
CREATE EXTENSION<br/>
epcis_ac=# CREATE EXTENSION IF NOT EXISTS "uuid-ossp";<br/>
CREATE EXTENSION<br/>
epcis_ac=# SELECT * FROM pg_extension;<br/>
