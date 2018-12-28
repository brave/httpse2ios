# Potential improvements:

 
### Solve predefined | options
`http://url.com/(one|two) -> https://url.com/$1`
This can be split into two rules, and handled since the results are known:

`[ 'url.com/two', 'url.com/one' ]`

(file exp: 4gamer.net.xml)


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