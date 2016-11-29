// epcis.js
// EPCIS model logic.
/**
 * @creator Jaehee Ha 
 * lovesm135@kaist.ac.kr
 * created and modified from duplicated thing.js
 * 2016.11.03
 * added subscription functionality
 * 2016.11.04
 * added furnishing functionality
 * 2016.11.05
 * added group access control functionality
 * 2016.11.11
 * added epcisurl properties
 * 2016.11.29
 */
var neo4j = require('neo4j');
var errors = require('./errors');
var User = require('./user');
var Group = require('./group');
var rest = require('../../rest');
var config = require('../../conf.json');
var neo4j_url = "http://"+config.NEO_ID+":"+config.NEO_PW+"@"+config.NEO_ADDRESS;
var cachedb = require('../db/cachedb');

var db = new neo4j.GraphDatabase({
    // Support specifying database info via environment variables,
    // but assume Neo4j installation defaults.
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
        neo4j_url,
    auth: process.env['NEO4J_AUTH'],
});
var db2 = new neo4j.GraphDatabase({
    // Support specifying database info via environment variables,
    // but assume Neo4j installation defaults.
    url: process.env['NEO4J_URL'] || process.env['GRAPHENEDB_URL'] ||
        neo4j_url,
    auth: process.env['NEO4J_AUTH'],
});

// Private constructor:

var EPCIS = module.exports = function EPCIS(_node) {
    // All we'll really store is the node; the rest of our properties will be
    // derivable or just pass-through properties (see below).
    this._node = _node;
};

// Public constants:

EPCIS.VALIDATION_INFO = {
    'epcisname': {
        required: true,
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Za-z0-9_.:]+$/,
        message: '2-50 characters; letters, numbers, underscores, \'.\', and \':\' only.'
    },
    'epcisurl': {
        required: true,
        minLength: 2,
        maxLength: 50,
        pattern: /^[A-Za-z0-9.:]+$/,
        message: '2-50 characters; letters, numbers, \'.\', and \':\' only.'
    },
};

// Public instance properties:

// The EPCIS prototype
Object.defineProperty(EPCIS.prototype, 'epcisname', {
    get: function () { return this._node.properties['epcisname']; }
});

//---validation features---
// Private helpers:

//Validates the given property based on the validation info above.
//By default, ignores null/undefined/empty values, but you can pass `true` for
//the `required` param to enforce that any required properties are present.
function validateProp(prop, val, required) {
 var info = EPCIS.VALIDATION_INFO[prop];
 var message = info.message;

 if (!val) {
     if (info.required && required) {
         throw new errors.ValidationError(
             'Missing ' + prop + ' (required).');
     } else {
         return;
     }
 }

 if (info.minLength && val.length < info.minLength) {
     throw new errors.ValidationError(
         'Invalid ' + prop + ' (too short). Requirements: ' + message);
 }

 if (info.maxLength && val.length > info.maxLength) {
     throw new errors.ValidationError(
         'Invalid ' + prop + ' (too long). Requirements: ' + message);
 }

 if (info.pattern && !info.pattern.test(val)) {
     throw new errors.ValidationError(
         'Invalid ' + prop + ' (format). Requirements: ' + message);
 }
}

// Takes the given caller-provided properties, selects only known ones,
// validates them, and returns the known subset.
// By default, only validates properties that are present.
// (This allows `EPCIS.prototype.patch` to not require any.)
// You can pass `true` for `required` to validate that all required properties
// are present too. (Useful for `EPCIS.create`.)
function validate(props, required) {
    var safeProps = {};

    for (var prop in EPCIS.VALIDATION_INFO) {
    	if(EPCIS.VALIDATION_INFO.hasOwnProperty(prop)){
    		var val = props[prop];
    		validateProp(prop, val, required);
    		safeProps[prop] = val;
        }
    }

    return safeProps;
}


function isConstraintViolation(err) {
    return err instanceof neo4j.ClientError &&
        err.neo4j.code === 'Neo.ClientError.Schema.ConstraintViolation';
}
//---validation features end---

// Public instance methods:

// Atomically updates this EPCIS, both locally and remotely in the db, with the
// given property updates.
EPCIS.prototype.patch = function (props, callback) {
    var safeProps = validate(props);

    var query = [
        'MATCH (EPCIS:EPCIS {epcisname: {thisEPCISname}})',
        'SET epcis += {props}',
        'RETURN epcis',
    ].join('\n');

    var params = {
        thisEPCISname: this.epcisname,
        props: safeProps,
    };

    var self = this;

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes gs1code is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the gs1code is taken or not.
            err = new errors.ValidationError(
                'The epcisname ‘' + props.epcisname + '’ is taken.');
        }
        if (err) {
        	return callback(err);
        }

        if (!results.length) {
            err = new Error('EPCIS has been deleted! epcisname: ' + self.epcisname);
            return callback(err);
        }

        // Update our node with this updated+latest data from the server:
        self._node = results[0]['epcis'];

        callback(null);
    });
};
//---deletion features---

EPCIS.del = function (username, epcisname, callback) {
    // Use a Cypher query to delete both this EPCIS and his/her following
    // relationships in one query and one network request:
    // (Note that this'll still fail if there are any relationships attached
    // of any other types, which is good because we don't expect any.)
    var query = [
          'MATCH (epcis:EPCIS {epcisname: {thisEPCISname}})',
          'MATCH (epcis)<-[:possess]-(user:User {username: {thisUsername}})',
          'DETACH DELETE epcis',
    ].join('\n');

    var params = {
        thisEPCISname: epcisname,
        thisUsername: username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        return callback(null, {result: "success"});
    });
};

EPCIS.unfurnish = function (username, epcisname, callback) {
    // Use a Cypher query to delete both this EPCIS and his/her following
    // relationships in one query and one network request:
    // (Note that this'll still fail if there are any relationships attached
    // of any other types, which is good because we don't expect any.)
    var query = [
          'MATCH (epcis:EPCIS {epcisname: {thisEPCISname}})',
          'MATCH (epcis)<-[rel:furnish]-(user:User {username: {thisUsername}})',
          'DELETE rel',
    ].join('\n');

    var params = {
        thisEPCISname: epcisname,
        thisUsername: username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        return callback(null, {result: "success"});
    });
};

EPCIS.unfurnishGroup = function (groupname, epcisname, callback) {
    // Use a Cypher query to delete both this EPCIS and his/her following
    // relationships in one query and one network request:
    // (Note that this'll still fail if there are any relationships attached
    // of any other types, which is good because we don't expect any.)
    var query = [
          'MATCH (epcis:EPCIS {epcisname: {thisEPCISname}})',
          'MATCH (epcis)<-[rel:furnish]-(group:Group {groupname: {thisGroupname}})',
          'DELETE rel',
    ].join('\n');

    var params = {
        thisEPCISname: epcisname,
        thisGroupname: groupname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        return callback(null, {result: "success"});
    });
};

EPCIS.unsubscribe = function (username, epcisname, callback) {
    // Use a Cypher query to delete both this EPCIS and his/her following
    // relationships in one query and one network request:
    // (Note that this'll still fail if there are any relationships attached
    // of any other types, which is good because we don't expect any.)
    var query = [
          'MATCH (epcis:EPCIS {epcisname: {thisEPCISname}})',
          'MATCH (epcis)<-[rel:subscribe]-(user:User {username: {thisUsername}})',
          'DELETE rel',
    ].join('\n');

    var params = {
        thisEPCISname: epcisname,
        thisUsername: username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        return callback(null, {result: "success"});
    });
};

EPCIS.unsubscribeGroup = function (groupname, epcisname, callback) {
    // Use a Cypher query to delete both this EPCIS and his/her following
    // relationships in one query and one network request:
    // (Note that this'll still fail if there are any relationships attached
    // of any other types, which is good because we don't expect any.)
    var query = [
          'MATCH (epcis:EPCIS {epcisname: {thisEPCISname}})',
          'MATCH (epcis)<-[rel:subscribe]-(group:Group {groupname: {thisGroupname}})',
          'DELETE rel',
    ].join('\n');

    var params = {
        thisEPCISname: epcisname,
        thisGroupname: groupname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        return callback(null, {result: "success"});
    });
};

//---deletion features end---
// Static methods:

EPCIS.F = function (epcisname, callback) {
    var query = [
        'MATCH (epcis:EPCIS {epcisname: {thisEPCISname}})',
        'RETURN epcis',
    ].join('\n');

    var params = {
        thisEPCISname: epcisname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        if (!results.length) {
            err = new Error('No such epcis with epcisname: ' + epcisname);
            return callback(err);
        }
        var epcis = new EPCIS(results[0]['epcis']);
        callback(null, epcis);
    });
};

// Creates the EPCIS and persists (saves) it to the db, incl. indexing it:
EPCIS.create = function (props, callback) {
    var query = [
        'CREATE (epcis:EPCIS {props})',
        'RETURN epcis',
    ].join('\n');
  
    var params = {
    	props: validate(props),
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes gs1code is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the gs1code is taken or not.
        	err = new errors.ValidationError(
                'The epcisname ‘' + props.epcisname + '’ is taken.');
        }
        if (err) {
        	return callback(err);
        }
        var epcis = new EPCIS(results[0]['epcis']);
        callback(null, epcis);
    });
};

//---url features---

EPCIS.setURL = function (epcisname, epcisurl_props, callback) {
    var query = [
        'MATCH (epcis:EPCIS {epcisname:{thisEPCISName}}) -[rel:hasURL]-> (other)',
        'DELETE rel',
        'WITH count(epcis) as dummy',
        'MATCH (epcisurl:EPCISURL {epcisurl:{thisEPCISURL}})',
        'RETURN epcisurl',
    ].join('\n');

    var params = {
        thisEPCISName: epcisname,
        thisEPCISURL: validate(epcisurl_props).epcisurl,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes gs1code is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the gs1code is taken or not.
            err = new errors.ValidationError(
                'The epcisname ‘' + props.epcisname + '’ is already exist.');
        }
        if (err) {
        	return callback(err);
        }
        var query = null;
        if (results.length !== null && results.length > 0){
        	query = [
	             'MATCH (epcis:EPCIS {epcisname:{thisEPCISName}})',
	             'MATCH (epcisurl:EPCISURL {epcisurl: {thisEPCISURL}})',
	             'MERGE (epcis) -[:hasURL]-> (epcisurl)',
	             'WITH count(epcis) as dummy',
        	     'MATCH (n) WHERE NOT (n)--() DELETE (n)',
	         ].join('\n');
        } else if (results.length !== null && results.length == 0){
        	query = [
	             'MATCH (epcis:EPCIS {epcisname:{thisEPCISName}})',
	             'CREATE (epcisurl:EPCISURL {epcisurl: {thisEPCISURL}})',
	             'MERGE (epcis) -[:hasURL]-> (epcisurl)',
	             'WITH count(epcis) as dummy',
        	     'MATCH (n) WHERE NOT (n)--() DELETE (n)',
	         ].join('\n');
        }
    	var params = {
    	    thisEPCISName: epcisname,
    	    thisEPCISURL: epcisurl_props.epcisurl,
         };

         db2.cypher({
             query: query,
             params: params,
         }, function (err, results) {
             if (err) {

             	return callback(err);
             }
             return callback(null, 'success');
         });
    });
};

EPCIS.getURL = function (epcisname, callback) {
    var query = [
        'MATCH (epcis:EPCIS {epcisname:{thisEPCISName}}) -[:hasURL]-> (epcisurl:EPCISURL)',
        'RETURN epcisurl',
    ].join('\n');

    var params = {
        thisEPCISName: epcisname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (isConstraintViolation(err)) {
            // TODO: This assumes gs1code is the only relevant constraint.
            // We could parse the constraint property out of the error message,
            // but it'd be nicer if Neo4j returned this data semantically.
            // Alternately, we could tweak our query to explicitly check first
            // whether the gs1code is taken or not.
            err = new errors.ValidationError(
                'The epcisname ‘' + epcisname + '’ is not exist.');
        }
        if (err) {
        	return callback(err);
        }
        var epcisurl = results[0]['epcisurl'].properties.epcisurl;
        callback(null, epcisurl);
    });
};

//---url features end---
//---permission check features---

EPCIS.isPossessor = function(username, epcisname, callback){
    var query = [
        'MATCH (epcis:EPCIS {epcisname: {thisEPCISname}})',
        'MATCH (epcis)<-[:possess]-(user:User {username: {thisUsername}})',
        'RETURN user',
    ].join('\n');

    
    var params = {
        thisEPCISname: epcisname,
        thisUsername: username,
    };

    db.cypher({
       query: query,
       params: params,
    }, function (err, results) {
       if (err) {
    	   return callback(err);
       }
       if(results.length>0){
    	   return callback(null, {result: "yes"});
       }
       callback(null, {result: "no"});
       
    });	
};

EPCIS.isFurnisher = function(username, epcisname, callback){
    var query = [
        'MATCH (epcis:EPCIS {epcisname: {thisEPCISname}})',
        'MATCH (user:User {username: {thisUsername}})',
        'MATCH (group:Group)',
        'WHERE (epcis)<-[:furnish]-(user)',
        'OR (epcis)<-[:furnish]-(group)<-[:join]-(user)',
        'RETURN user',
    ].join('\n');

    
    var params = {
        thisEPCISname: epcisname,
        thisUsername: username,
    };

    db.cypher({
       query: query,
       params: params,
    }, function (err, results) {
       if (err) {
    	   return callback(err);
       }
       if(results.length>0){
    	   return callback(null, {result: "yes"});
       }
       return callback(null, {result: "no"});
    });	
};

EPCIS.isSubscriber = function(username, epcisname, callback){
    var query = [
         'MATCH (epcis:EPCIS {epcisname: {thisEPCISname}})',
         'MATCH (user:User {username: {thisUsername}})',
         'MATCH (group:Group)',
         'WHERE (epcis)<-[:subscribe]-(user)',
         'OR (epcis)<-[:subscribe]-(group)<-[:join]-(user)',
         'RETURN user',
    ].join('\n');

    
    var params = {
        thisEPCISname: epcisname,
        thisUsername: username,
    };

    db.cypher({
       query: query,
       params: params,
    }, function (err, results) {
       if (err) {
    	   return callback(err);
       }
       if(results.length>0){
    	   return callback(null, {result: "yes"});
       }
       return callback(null, {result: "no"});
    });	
};


EPCIS.isAuthority = function(username, epcisname, callback){
	cachedb.loadCachedData(username+':'+epcisname, function(err, results){
		if(results && JSON.parse(results).authority){
			console.log("cache hit for :"+username+":"+epcisname);
			cachedb.setExpire(username+':'+epcisname, config.REDIS_DEFAULT_EXPIRE);
			if(JSON.parse(results).authority === 'true'){
		    	return callback(null, {result: "success", epcisname: epcisname});
			} else{
				return callback(null, {result: "You are not authorized for the epcis: "+epcisname });
			}
		}
		
		EPCIS.isPossessor(username, epcisname, function(err, results){
			if(err) {
				return callback(err);
			}
			if(results.result === "no"){
			    var query = [
			        'MATCH (epcis:EPCIS {epcisname: {thisEPCISname}}),(user:User)',
			        'WHERE user.username = {thisUsername}',
			        'RETURN user',
			    ].join('\n');
			
			    var params = {
			    	thisEPCISname: epcisname,
			    	thisUsername: username,
			    };
			
			    db.cypher({
			       query: query,
			       params: params,
			    }, function (err, results) {
			       if (err) {
			    	   return callback(err);
			       }
			       if(results.length>0){
			    	   cachedb.cacheDataWithExpire(username+':'+epcisname, JSON.stringify({authority:"true"}), config.REDIS_DEFAULT_EXPIRE);
			    	   return callback(null, {result: "success", epcisname: epcisname});
			       }
			       callback(null, {result: "You are not authorized for the epcis: "+epcisname });
			       cachedb.cacheDataWithExpire(username+':'+epcisname, JSON.stringify({authority:"false"}), config.REDIS_DEFAULT_EXPIRE);
			       
			    });
			} else {
				callback(null, {result: "success", epcisname: epcisname});
				cachedb.cacheDataWithExpire(username+':'+epcisname, JSON.stringify({authority:"true"}), config.REDIS_DEFAULT_EXPIRE);
			}
		});
	});	
};

//---permission check features end---
//---getting features ---

EPCIS.get = function (epcisname, callback) {
    var query = [
        'MATCH (epcis:EPCIS {epcisname: {thisEPCISname}})',
        'RETURN epcis',
    ].join('\n');

    var params = {
        thisEPCISname: epcisname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }
        if (!results.length) {
            err = new Error('No such epcis with epcisname: ' + epcisname);
            return callback(err);
        }
        var epcis = new EPCIS(results[0]['epcis']);
        callback(null, epcis);
    });
};

EPCIS.getFurnisher = function (epcisname, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User)-[:furnish]->(epcis:EPCIS {epcisname: {thisEPCISname}})',
        'RETURN user', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisEPCISname: epcisname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var epcisfurnishers = [];

        for (var i = 0; i < results.length; i++) {
        	var epcisfurnisher = results[i].user.properties;
        	epcisfurnishers.push(epcisfurnisher.username);
        }

        callback(null, epcisfurnishers);
    });
};

EPCIS.getFurnisherOthers = function (epcisname, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User)',
        'WHERE not((user)-[:furnish]->(:EPCIS {epcisname: {thisEPCISname}}))',
        'RETURN user', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisEPCISname: epcisname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var epcisfurnisherothers = [];

        for (var i = 0; i < results.length; i++) {
        	var epcisfurnisherother = results[i].user.properties;
        	epcisfurnisherothers.push(epcisfurnisherother.username);
        }

        callback(null, epcisfurnisherothers);
    });
};

EPCIS.getFurnisherGroup = function (epcisname, username, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User {username: {thisUsername}})-[:manage]->(group:Group)',
        'MATCH (group)-[:furnish]->(epcis:EPCIS {epcisname: {thisEPCISname}})',
        'RETURN group', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisEPCISname: epcisname,
        thisUsername: username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var epcisfurnishergroups = [];

        for (var i = 0; i < results.length; i++) {
        	var epcisfurnishergroup = results[i].group.properties;
        	epcisfurnishergroups.push(epcisfurnishergroup.groupname);
        }

        callback(null, epcisfurnishergroups);
    });
};

EPCIS.getFurnisherOthersGroup = function (epcisname, username, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User {username: {thisUsername}})-[:manage]->(group:Group)',        
        'MATCH (group)',
        'WHERE not((group)-[:furnish]->(:EPCIS {epcisname: {thisEPCISname}}))',
        'RETURN group', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisEPCISname: epcisname,
        thisUsername: username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var epcisfurnisherothersgroup = [];

        for (var i = 0; i < results.length; i++) {
        	var epcisfurnisherothergroup = results[i].group.properties;
        	epcisfurnisherothersgroup.push(epcisfurnisherothergroup.groupname);
        }

        callback(null, epcisfurnisherothersgroup);
    });
};

EPCIS.getSubscriber = function (epcisname, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User)-[:subscribe]->(epcis:EPCIS {epcisname: {thisEPCISname}})',
        'RETURN user', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisEPCISname: epcisname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var epcissubscribers = [];

        for (var i = 0; i < results.length; i++) {
        	var epcissubscriber = results[i].user.properties;
        	epcissubscribers.push(epcissubscriber.username);
        }

        callback(null, epcissubscribers);
    });
};

EPCIS.getSubscriberOthers = function (epcisname, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
         'MATCH (user:User)',
         'WHERE not((user)-[:subscribe]->(:EPCIS {epcisname: {thisEPCISname}}))',
         'RETURN user', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisEPCISname: epcisname,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var epcissubscriberothers = [];

        for (var i = 0; i < results.length; i++) {
        	var epcissubscriberother = results[i].user.properties;
        	epcissubscriberothers.push(epcissubscriberother.username);
        }

        callback(null, epcissubscriberothers);
    });
};

EPCIS.getSubscriberGroup = function (epcisname, username, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User {username: {thisUsername}})-[:manage]->(group:Group)',
        'MATCH (group)-[:subscribe]->(epcis:EPCIS {epcisname: {thisEPCISname}})',
        'RETURN group', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisEPCISname: epcisname,
        thisUsername: username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var epcissubscribergroups = [];

        for (var i = 0; i < results.length; i++) {
        	var epcissubscribergroup = results[i].group.properties;
        	epcissubscribergroups.push(epcissubscribergroup.groupname);
        }

        callback(null, epcissubscribergroups);
    });
};

EPCIS.getSubscriberOthersGroup = function (epcisname, username, callback) {

    // Query all users and whether we follow each one or not:
    var query = [
        'MATCH (user:User {username: {thisUsername}})-[:manage]->(group:Group)', 
        'MATCH (group:Group)',
        'WHERE not((group)-[:subscribe]->(:EPCIS {epcisname: {thisEPCISname}}))',
        'RETURN group', // COUNT(rel) is a hack for 1 or 0
    ].join('\n');

    var params = {
        thisEPCISname: epcisname,
        thisUsername: username,
    };

    db.cypher({
        query: query,
        params: params,
    }, function (err, results) {
        if (err) {
        	return callback(err);
        }

        var epcissubscriberothersgroup = [];

        for (var i = 0; i < results.length; i++) {
        	var epcissubscriberothergroup = results[i].group.properties;
        	epcissubscriberothersgroup.push(epcissubscriberothergroup.groupname);
        }

        callback(null, epcissubscriberothersgroup);
    });
};

//--- getting features end---

EPCIS.isAuthoritybyTraversal = function(username, epcisname, callback){
	EPCIS.get(epcisname, function(err, epcis){
		if (err) {
			//console.log(err);
			return callback(err);
		}
		epcis.isNeighbor(username, function(err, result){
			if(err){
				return callback(err);
			}
			if(result.result === 'success') {
				return callback(null, {result: "success"});
			}

			var operation = 'db/data/node/'+epcis._node._id+'/traverse/node';
			
			var argJson = {
				"order" : "breadth_first",
				"return_filter" : {
					"body" : "position.endNode().hasProperty(\'username\')&&position.endNode().getProperty(\'username\') == \'"+username+"\'",
					"language" : "javascript"
				},
				"prune_evaluator" : {
					"body" : "position.endNode().hasProperty(\'username\')&&position.endNode().getProperty(\'username\') == \'"+username+"\'",
					"language" : "javascript"
				},
				"uniqueness" : "node_global",
				"relationships" : {
					"direction" : "out",
					"type" : "familyship"
				},
				"max_depth" : 7
			};
			var args = JSON.stringify(argJson);
						
			rest.postOperation('http://'+config.NEO_ADDRESS, operation, args, function(err, results){
				if (err){
					console.log(err);
					return callback(err);
				}
				//console.log(results.length);
				if(results.length>0){
					return callback(null, {result: "success"});
				}
				return callback("You are not authorized for the EPCIS: "+epcisname);
			});
		});
	});
};



// Static initialization:

// Register our unique EPCIS constraint.
// TODO: This is done async'ly (fire and forget) here for simplicity,
// but this would be better as a formal schema migration script or similar.
db.createConstraint({
    label: 'EPCIS',
    property: 'epcisname',
    
}, function (err, constraint) {
    if (err) {
    	throw err;     // Failing fast for now, by crash the application.
    }
    if (constraint) {
        console.log('(Registered unique epcisnames constraint.)');
    } else {
        // Constraint already present; no need to log anything.
    }
});

//Register our unique EPCISURL constraint.
//TODO: This is done async'ly (fire and forget) here for simplicity,
//but this would be better as a formal schema migration script or similar.
db.createConstraint({
 label: 'EPCISURL',
 property: 'epcisurl',
 
}, function (err, constraint) {
 if (err) {
 	throw err;     // Failing fast for now, by crash the application.
 }
 if (constraint) {
     console.log('(Registered unique epcisurls constraint.)');
 } else {
     // Constraint already present; no need to log anything.
 }
});

