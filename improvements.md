# Potential improvements:

 
### Solve predefined | options
`http://url.com/(one|two) -> https://url.com/$1`
This can be split into two rules, and handled since the results are known:

`[ 'url.com/two', 'url.com/one' ]`

(file exp: `4gamer.net.xml`)


### Process certain Placeholders
In some situations placeholders may contain nothing:

from: `^http://(www\.)?url.com` -> to: `https://$1url.com`

In these situations `$1` can be removed and tested against the `from`:
`from.test(to.remove(`$1`))`

Solving `predefined | options` above (see above section), would also probably auto-solve this issue.
(file exp: `Dropbox.xml`)


### Handling exclusions
https://www.eff.org/https-everywhere/rulesets#exclusions
See `function includesExclusion`


### Wildcard exclusions:
```
<target host="*.ctep-ebp.com" />

<rule from="^http://www\.ctep-ebp\.com/" 
    to="https://ctep-ebp.com/" />

<rule from="^http:" to="https:" />
```
(source: `CTEP-EBP.com.xml`)

Here the target works for everything _except_ `www.ctep-ebp.com`, so including this rule while later providing an exception for the `www` URL, is optimal.

See `function invalidWildcardHost`