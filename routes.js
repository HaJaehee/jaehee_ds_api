var bodyParser = require('body-parser'),
	oauthserver = require('oauth2-server'),
	md5 =  require('md5'),
	auth = require('./models/acc/auth'),
	User = require('./models/acc/user'),
	EPCIS = require('./models/acc/epcis')
	Group = require('./models/acc/group'),
	rest = require('./rest'),
	qs = require('querystring'),
	dns = require('native-dns');
	

var config = require('./conf.json');
var EPCIS_CaptureURL = config.EPCIS_CAPTURE_URL,
	EPCIS_QueryURL = config.EPCIS_QUERY_URL,
	EPCIS_Address = config.EPCIS_ADDRESS;
var EPCIS_Capture_Address = "http://"+EPCIS_Address+EPCIS_CaptureURL,
	EPCIS_Query_Address = "http://"+EPCIS_Address+EPCIS_QueryURL;


exports.configure = function (app) {	
	 
	app.use(bodyParser.urlencoded({ extended: true }));
	 
	app.use(bodyParser.json());
	 
	app.oauth = oauthserver({
	  model: require('./models/acc/auth'), 
	  grants: ['password', 'refresh_token'],
	  debug: true,
	  accessTokenLifetime: 36000/*,
	  refreshTokenLifetime: 999999999*/
	});

	app.all('/oauth/token', app.oauth.grant()); 
	
	app.use(app.oauth.errorHandler());
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.10.31
	 * 
	 */ 
	app.del('/epcis'/*, app.oauth.authorise()*/, function (req, res){
		
		EPCIS.delall(function(err){
			if(err) {
				return err;
			}
			res.send({result: "success"});
			
		});
		
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.03
	 * 
	 */ 
	app.del('/epcis/:epcisname', app.oauth.authorise(), function (req, res){
		EPCIS.get(req.params.epcisname, function (err, epcis){
			if (err) {
				return res.send({error: err});
			}
			epcis.del(function(err){
				if (err) {
					return res.send({error: err});
				}
				res.send({result: "success"});
			});
		});
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.03
	 * 
	 */ 
	app.get('/user/:username/possess', app.oauth.authorise(), function (req, res){
		User.getPossess(req.params.username, function (err, epciss){
			if(err) {
				return res.send({error:err});
			}
			res.send({epciss:epciss});
		});
	});
	

	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.03
	 * 
	 */ 
	app.post('/user/:username/possess', app.oauth.authorise(), function (req, res){
		EPCIS.create({'epcisname':req.body.epcisname}, function(err1, epcis){
			if(err1){
				res.send({ error : err1});
				return;
			}
			User.get(req.params.username, function(err2, user){
				if(err2) {
					return res.send({ error : err2});
				}
				user.possess(epcis, function(err3){
					if(err3) {
						return res.send({ error : err3});
					}
					res.send({result: "success"});
				});
			});
		});
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.03
	 * 
	 */ 
	app.get('/user/:username/epcis/:epcisname/possess', app.oauth.authorise(), function (req, res){
		EPCIS.isPossessor(req.params.username, req.params.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}		
			res.send({possessor: results.result});
		});
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.07
	 * 
	 */ 
	app.get('/user/:username/epcis/:epcisname/furnish', app.oauth.authorise(), function (req, res){
		EPCIS.isFurnisher(req.params.username, req.params.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}		
			res.send({furnisher: results.result});
		});
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.05
	 * 
	 */ 
	app.get('/user/:username/epcis/:epcisname/subscribe', app.oauth.authorise(), function (req, res){
		EPCIS.isSubscriber(req.params.username, req.params.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}		
			res.send({subscriber: results.result});
		});
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.05
	 * 
	 */ 
	app.get('/user/:username/furnish', app.oauth.authorise(), function (req, res){
		User.getFurnish(req.params.username, function (err, epcisfurns){
			if(err) {
				return res.send({error:err});
			}
			res.send({epcisfurns:epcisfurns});
		});
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.05
	 * 
	 */ 
	app.post('/epcis/:epcisname/furnish', app.oauth.authorise(), function (req, res){
		EPCIS.get(req.params.epcisname, function(err1, epcis){
			if (err1) {
				return res.send({error: err1});
			}
			User.get(req.body.epcisfurnishername, function(err2, user){
				if(err2) {
					return res.send({ error : err2});
				}
				user.furnish(epcis, function(err3){
					if(err3) {
						return res.send({ error : err3});
					}
					res.send({result: "success"});
				});
			});
		});
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.04
	 * 
	 */ 
	app.get('/epcis/:epcisname/furnisher', app.oauth.authorise(), function (req, res){
		
		EPCIS.getFurnisher(req.params.epcisname, function (err, epcisfurnishers){
			if(err) {
				return res.send({error:err});
			}
			res.send({epcisfurnishers:epcisfurnishers});
		});
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.07
	 * 
	 */ 
	app.get('/epcis/:epcisname/furnisher/others', app.oauth.authorise(), function (req, res){
		
		EPCIS.getFurnisherOthers(req.params.epcisname, function (err, epcisfurnisherothers){
			if(err) {
				return res.send({error:err});
			}
			res.send({epcisfurnisherothers:epcisfurnisherothers});
		});
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.04
	 * 
	 */
	app.del('/unfurnepcis/:epcisname/user/:epcisfurnishername', app.oauth.authorise(), function (req, res){
		
		EPCIS.isFurnisher(req.params.epcisfurnishername, req.params.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}		
			
			if (results.result === 'yes')
			{
				EPCIS.unfurnish(req.params.epcisfurnishername, req.params.epcisname, function (err){
					if (err) {
						return res.send({error: err});
					}
					res.send({result: "success"});
				});
			}
			else 
			{
				res.send({error:err});
			}
		});
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.04
	 * 
	 */ 
	app.get('/user/:username/subscribe', app.oauth.authorise(), function (req, res){
		User.getSubscribe(req.params.username, function (err, epcissubss){
			if(err) {
				return res.send({error:err});
			}
			res.send({epcissubss:epcissubss});
		});
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.04
	 * 
	 */ 
	app.post('/epcis/:epcisname/subscribe', app.oauth.authorise(), function (req, res){
		EPCIS.get(req.params.epcisname, function(err1, epcis){
			if (err1) {
				return res.send({error: err1});
			}
			User.get(req.body.epcissubscribername, function(err2, user){
				if(err2) {
					return res.send({ error : err2});
				}
				user.subscribe(epcis, function(err3){
					if(err3) {
						return res.send({ error : err3});
					}
					res.send({result: "success"});
				});
			});
		});
	});
	

	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.07
	 * 
	 */ 
	app.get('/epcis/:epcisname/subscriber/others', app.oauth.authorise(), function (req, res){
		
		EPCIS.getSubscriberOthers(req.params.epcisname, function (err, epcissubscriberothers){
			if(err) {
				return res.send({error:err});
			}
			res.send({epcissubscriberothers:epcissubscriberothers});
		});
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.04
	 * 
	 */ 
	app.get('/epcis/:epcisname/subscriber', app.oauth.authorise(), function (req, res){
		EPCIS.getSubscriber(req.params.epcisname, function (err, epcissubscribers){
			if(err) {
				return res.send({error:err});
			}
			res.send({epcissubscribers:epcissubscribers});
		});
	});
	

	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.04
	 * 
	 */
	app.del('/unsubsepcis/:epcisname/user/:epcissubscribername', app.oauth.authorise(), function (req, res){
		
		EPCIS.isSubscriber(req.params.epcissubscribername, req.params.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}		
			
			if (results.result === 'yes')
			{
				EPCIS.unsubscribe(req.params.epcissubscribername, req.params.epcisname, function (err){
					if (err) {
						return res.send({error: err});
					}
					res.send({result: "success"});
				});
			}
			else 
			{
				res.send({error:err});
			}
		});
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.04
	 * 
	 */
	app.del('/delepcis/:epcisname', app.oauth.authorise(), function (req, res){
		
		EPCIS.isPossessor(req.body.username, req.body.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}		
			
			if (results.result === 'yes')
			{
				EPCIS.del(req.body.username, req.body.epcisname, function (err){
					if (err) {
						return res.send({error: err});
					}
					rest.delOperation(EPCIS_Capture_Address, "" , req.body.epcisname, function (error, response) {
						if (error) {
							return res.send({error: error});
						} else {
							res.send({result: "success"});
						}
					});
				});
			}
			else 
			{
				res.send({error:err});
			}
		});
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.04
	 *
	 */
	app.post('/user/:username/epcis/:epcisname/capture', app.oauth.authorise(), function (req, res){

		EPCIS.isFurnisher(req.params.username, req.params.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}
			
			if ( results.result === 'yes')
			{
				var epcisevent = req.body.epcisevent;
				rest.postOperation(EPCIS_Capture_Address, "" , epcisevent, function (error, response) {
					if (error) {
						return res.send({error: error});
					} else {
						res.send({result: "success"});
					}
				});
			}
			else 
			{
				res.send({error:err});
			}
		});
		
	});
	
	/** 
	 * @creator Jaehee Ha
	 * lovesm135@kaist.ac.kr
	 * created
	 * 2016.11.05
	 * TODO will be implemented
	 */
	app.post('/user/:username/epcis/:epcisname/query', app.oauth.authorise(), function (req, res){

		EPCIS.isSubscriber(req.params.username, req.params.epcisname, function(err, results){
			if(err) {
				return res.send({error:err});
			}
			
			if (results.result === 'yes')
			{
				var epcisquery = req.body.epcisquery;
				console.log(epcisquery);
				rest.getOperation(EPCIS_Query_Address+"EPCISName="+req.params.epcisname+"&"+epcisquery, "" , "", function (error, response) {
					if (error) {
						return res.send({error: error});
					} else {
						res.send({result: "success"});
					}
				});
			}
			else 
			{
				res.send({error:err});
			}
		});
		
	});
	
	
	app.get('/user/:username/manage', app.oauth.authorise(), function (req, res){
		User.getManage(req.params.username, function (err, groups){
			if(err) {
				return res.send({error:err});
			}
			res.send({groups:groups});
		});
	});
	
	app.post('/user/:username/manage', app.oauth.authorise(), function (req, res){
		var groupname = req.body.groupname;
		if(groupname.indexOf(req.params.username+':') !== 0){
			groupname = req.params.username+':'+req.body.groupname;
		}	
		Group.create({'groupname':groupname}, function(err1, group){
			if(err1){
				res.send({ error : err1.message});
				return;
			}
			User.get(req.params.username, function(err2, user){
				if(err2) {
					return res.send({ error : err2});
				}
				user.manage(group, function(err3){
					if(err3) {
						return res.send({ error : err3});
					}
			    	res.send({result: "success"});
				});
			});
		});
		
	});
	
	app.post('/user/:username/unmanage', app.oauth.authorise(), function (req, res){
		var groupname = req.body.groupname;
		if(groupname.indexOf(req.params.username+':') !== 0){
			groupname = req.params.username+':'+req.body.groupname;
		}
		
		User.get(req.params.username, function (err1, user) {
			if(err1){
				return res.send({ error : err1});
			}
			Group.get(groupname, function (err2, group) {
				if(err2) {
					return res.send({error : err2});
				}
				user.unmanage(group, function (err3){
					if(err3) {
						return res.send({error : err3});
					}
			    	res.send({result: "success"});
				});
			});
		});
	});


	app.get('/group/:groupname/join', app.oauth.authorise(), function (req, res){
		Group.get(req.params.groupname, function (err, group){
			group.getMemberAndOthers(function (err, users, others){
				if(err) {
					return res.sent({error: err});
				}
				res.send({users:users});
			});
		});
	});
	
	app.get('/group/:groupname/other', app.oauth.authorise(), function (req, res){
		Group.get(req.params.groupname, function (err, group){
			group.getMemberAndOthers(function (err, users, others){
				if(err) {
					return res.sent({error: err});
				}
				res.send({others:others});
			});
		});
	});

	
	app.post('/group/:groupname/join', app.oauth.authorise(), function (req, res){
		Group.get(req.params.groupname, function(err1, group){
			if(err1) {
				return res.send({ error : err1});
			}
			User.get(req.body.username, function(err2, user){
				if(err2) {
					return res.send({ error : err2});
				}
				group.join(user, function(err3){
					if(err3) {
						return res.send({ error : err3});
					}
			    	res.send({result: "success"});
				});
			});
		});
		
	});
	
	
	app.post('/group/:groupname/unjoin', app.oauth.authorise(), function (req, res){

		Group.get(req.params.groupname, function(err1, group){
			if(err1) {
				return res.send({ error : err1});
			}
			User.get(req.body.username, function(err2, user){
				if(err2) {
					return res.send({ error : err2});
				}
				group.unjoin(user, function(err3){
					if(err3) {
						return res.send({ error : err3});
					}
			    	res.send({result: "success"});
				});
			});
		});
	});
	
	app.get('/getClientidAndToken', function(req, res){
		auth.getClientidAndToken(function (err, results){
			if (err){
				console.log(err);
				return res.send({error: err});
			}
			return res.send(results);
			
		});
	});
	
	app.post('/signup', function (req, res){
		
		auth.getUserbyUsername(req.body.username, function(err, result){
			if(err || result){
				res.send(err? { error : err }: { error : "user already exists"});
				return;
			} 
			auth.saveUser(req.body.username, req.body.password, function(err){
				if(err){
					res.send({ error : err });
					return;
				}
				auth.saveOauthClient(req.body.username.replace(/\./gi,"").replace(/@/gi,""), req.body.password, '/', function(err, result){
					if(err){
						res.send({ error : err });
						return;
					}
					User.create({'username':req.body.username}, function(err, user){
		    			if(err){
							res.send({ error : err });
							return;
		    			}
		    			Group.create({'groupname':req.body.username+':public'}, function(err, group){
			    			if(err){
								res.send({ error : err });
								return;
			    			}
			    			user.manage(group, function(err){
			    				if(err) {
			    					return res.send({ error : err});
			    				}
			    			    res.send({result: "success"});
			    			});
		    			});
		    		});
				});
			});
		});
	});
};
	
