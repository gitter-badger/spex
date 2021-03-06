<a name="PromiseAdapter"></a>
## PromiseAdapter
**Summary**: Adapter for the primary promise operations.  

---
Provides compatibility with promise libraries that cannot be recognized automatically,via functions that implement the primary operations with promises: - construct a new promise with a callback function - resolve a promise with some result data - reject a promise with a reason#### ExampleBelow is an example of setting up a <a href="https://github.com/vitaly-t/spex/blob/master/docs/client.md">client-side</a> adapter for AngularJS $q.```jsvar spexLib = require('spex'); // or include client-side spex.jsvar adapter = new spexLib.PromiseAdapter(   function (cb) {       return $q(cb); // creating a new promise;   }, function (data) {       return $q.when(data); // resolving a promise;   }, function (reason) {       return $q.reject(reason); // rejecting a promise;   });var spex = spexLib(adapter);```Please note that AngularJS 1.4.1 or later no longer requires a promise adapter.

### Parameters
<table>
  <thead>
    <tr>
      <th>Param</th><th>Type</th><th>Description</th>
    </tr>
  </thead>
  <tbody>
<tr>
    <td>create</td><td><code>function</code></td><td><p>A function that takes a callback parameter and returns a new promise object.
The callback parameter is expected to be <code>function(resolve, reject)</code>.</p>
<p>Passing in anything other than a function will throw <code>Adapter requires a function to create a promise.</code></p>
</td>
    </tr><tr>
    <td>resolve</td><td><code>function</code></td><td><p>A function that takes an optional data parameter and resolves a promise with it.</p>
<p>Passing in anything other than a function will throw <code>Adapter requires a function to resolve a promise.</code></p>
</td>
    </tr><tr>
    <td>reject</td><td><code>function</code></td><td><p>A function that takes an optional error parameter and rejects a promise with it.</p>
<p>Passing in anything other than a function will throw <code>Adapter requires a function to reject a promise.</code></p>
</td>
    </tr>  </tbody>
</table>

**See**: <a href="module.md">module</a>, <a href="https://github.com/vitaly-t/spex/blob/master/docs/client.md">client-side</a>  
