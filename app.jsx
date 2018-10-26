'use strict';

(function() {

window.App = createReactClass({
	getInitialState: function() {
		return {
			error: null,
			contests: null,
			problems: null,
			problemStats: null,
			problemset: [],
			users: [],
			submits: {}
		};
	},

	componentDidMount: function() {
		window.addEventListener('hashchange', this.handleHashChange);
		this.handleHashChange();
		this.load();
	},

	componentWillUnmount: function() {
		window.removeEventListener('hashchange', this.handleHashChange);
	},

	handleHashChange: function() {
		var hash = window.location.hash && window.location.hash.substring(1);

		var params = {};
		hash.split('&').forEach(function(s) {
			s = s.split('=');
			params[s[0]] = decodeURIComponent(s[1]);
		});

		if (!params.problems || !params.users) {
			this.setState({error: 'missing "problems" (e.g. "1073A,1073B") and/or "users" (e.g. "o948") parameter in location hash'});
			return;
		}

		var ps = params.problems.split(',');
		var us = params.users.split(',');

		this.setState({problemset: ps, users: us, submits: {}});
		this.fetch(us);
	},

	load: function() {
		var self = this;
		this.ajax({
			url: 'https://codeforces.com/api/contest.list',
			success: function(data) {
				if (data.status !== 'OK') {
					self.setState({error: data.comment});
					return;
				}
				var cs = {};
				data.result.forEach(function(c) {
					cs[c.id] = c;
				});
				self.setState({contests: cs});
			}
		});
		this.ajax({
			url: 'https://codeforces.com/api/problemset.problems',
			success: function(data) {
				if (data.status !== 'OK') {
					self.setState({error: data.comment});
					return;
				}
				var ps = {};
				var ss = {};
				data.result.problems.forEach(function(p) {
					ps[p.contestId + p.index] = p;
				});
				data.result.problemStatistics.forEach(function(s) {
					ss[s.contestId + s.index] = s;
				});
				self.setState({problems: ps, problemStats: ss});
			}
		});
	},

	fetch: function(users) {
		var self = this;
		users.forEach(function(u) {
			self.ajax({
				url: 'https://codeforces.com/api/user.status?handle=' + u,
				success: function(data) {
					if (data.status !== 'OK') {
						self.setState({error: data.comment});
						return;
					}
					self.state.submits[u] = data.result;
					self.setState({submits: self.state.submits});
				}
			});
		});
	},

	render: function() {
		if (this.state.error !== null) {
			return <div className="error">({ this.state.error })</div>;
		}
		if (!this.state.contests || !this.state.problems
				|| this.state.users.length !== Object.keys(this.state.submits).length) {
			return <div className="loading"></div>;
		}

		var self = this;

		var solved = {};
		this.state.users.forEach(function(u) {
			solved[u] = {};
			self.state.submits[u].forEach(function(s) {
				if (s.verdict === 'OK') {
					solved[u][s.problem.contestId + s.problem.index] = s;
				}
			});
		});

		var me = this.state.users[0];
		var friends = this.state.users.slice(1);

		var rows = [];
		var done = 0;
		this.state.problemset.forEach(function(id) {
			var p = self.state.problems[id];
			if (!p) {
				return;
			}
			var c = self.state.contests[p.contestId];

			var cols = [];
			cols.push(
				<td className="myStatus">
					<SubmitFmt submit={solved[me][id]} text={'\u2714'} />
				</td>
			);
			cols.push(
				<td className="problem">
					<ProblemFmt problem={p} contest={c} />
				</td>
			);
			friends.forEach(function(u) {
				cols.push(
					<td className="friendStatus">
						<SubmitFmt submit={solved[u][id]} text='+' />
					</td>
				);
			});

			var clazz = null;
			if (solved[me][id]) {
				clazz = 'solved';
				done++;
			}
			rows.push(<tr key={id} className={clazz}>{cols}</tr>);
		});

		var head = [];
		head.push(<th>{me}</th>);
		head.push(<th>Problems (solved: {done}/{rows.length})</th>);
		friends.forEach(function(u) {
			head.push(<th>{u}</th>);
		});

		return (
			<div id="problems">
				<table>
					<thead><tr>{head}</tr></thead>
					<tbody>{rows}</tbody>
				</table>
			</div>
		);
	},

	ajax: limitRate(3, function(opts) {
		var self = this;
		opts.error = function(xhr, status, err) {
			self.setState({error: err.toString() || status});
		};
		$.ajax(opts);
	})
});

var SubmitFmt = createReactClass({
	render: function() {
		var s = this.props.submit;
		if (!s) {
			return null;
		}
		var url = 'https://codeforces.com/contest/' + s.contestId + '/submission/' + s.id;
		return <a href={url} target="_blank">{this.props.text}</a>;
	}
});

var ProblemFmt = createReactClass({
	render: function() {
		var p = this.props.problem;
		var c = this.props.contest;

		var name = p.contestId + p.index + ' - ' + p.name;
		var div = contestDiv(c);
		if (div) {
			name += ' (Div. ' + div + ')';
		}

		var url = 'https://codeforces.com/problemset/';
		if (p.contestId >= 100000) {
			url += 'gymProblem/' + p.contestId + '/' + p.index;
		} else {
			url += 'problem/' + p.contestId + '/' + p.index;
		}
		return <a href={url} className={problemClass(p, div)} target="_blank">{name}</a>;
	}
});

function contestDiv(c) {
	if (c.name.indexOf('Div. 1') !== -1 || c.name.indexOf('Div 1') !== -1) {
		return 1;
	}
	if (c.name.indexOf('Div. 2') !== -1 || c.name.indexOf('Div 2') !== -1) {
		return 2;
	}
	return 0;
}

function problemClass(p, div) {
	if (div === 2 && p.index < 'C') {
		return 'easy';
	}
	if (div === 1 && p.index >= 'C' || div === 2 && p.index >= 'E') {
		return 'hard';
	}
	return 'medium';
}

function limitRate(n, f) {
	var ts = [];
	return function(args) {
		var now = Date.now();
		while (ts.length && ts[0] < now - 1000) {
			ts.shift();
		}
		if (ts.length < n) {
			ts.push(now);
		} else {
			ts.push(ts[ts.length - n] + 1000);
		}
		setTimeout(f, ts[ts.length - 1] - now, args);
	};
}

})();

