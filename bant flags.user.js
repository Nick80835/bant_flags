// ==UserScript==
// @name        /bant/ flags
// @namespace   bantflags
// @description Extra flags for /bant/.
// @match       http*://boards.4chan.org/bant/*
// @version     1.4.3
// @grant       GM_xmlhttpRequest
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// @grant       GM_unregisterMenuCommand
// @run-at      document-end
// @updateURL   https://raw.githubusercontent.com/Nick80835/bant_flags/main/bant%20flags.user.js
// @downloadURL https://raw.githubusercontent.com/Nick80835/bant_flags/main/bant%20flags.user.js
// @icon        https://raw.githubusercontent.com/Nick80835/bant_flags/main/flags/0077.png
// ==/UserScript==

//
//
// INIT SHIT
//
//

const flagsStyle = `
.bantFlag {
	padding: 0px 0px 0px 5px;
	display: inline-block;
	width: 16px;
	height: 11px;
	position: relative;
}

.bantflags_flag {
	padding: 1px;
}

[title ^= "Romania"]
{
	position: relative;
	animation: shake 0.1s linear infinite;
}

@keyframes shake {
	0 % { left: 1px; }
	25 % { top: 2px; }
	50 % { left: 1px; }
	75 % { left: 0px; }
	100 % { left: 2px; }
}

.flagsForm {
	float: right;
	clear: right;
	margin: 4px 0 4px 0;
}

#flagSelect {
	display: none;
  position: absolute;
}

#flagSelect ul {
	list-style-type: none;
	padding: 0;
	margin-bottom: 0;
	cursor: pointer;
	bottom: 100%;
	height: 200px;
	overflow: auto;
	position: absolute;
	width: 200px;
	background-color: #fff;
}

#flagSelect ul li {
	display: block;
}

#flagSelect ul li:hover {
	background-color: #ddd;
}

#flagSelect input {
	width: 200px;
}

#flagLoad {
	width: 200px;
}

#flagSelect.hide {
	display: none;
}

#flagSelect img {
	margin-left: 2px;
}

.flag{
	top: 0px;
	left: -1px;
}

.hide {
	display: none;
}`

const flagsForm = `
<span id="bantflags_container"></span>
<button type="button" style="width: 50px;" id="append_flag_button" title="Click to add selected flag to your flags. Click on flags to remove them." disabled="true">&lt;&lt;</button>
<button id="flagLoad" type="button">Click to load flags.</button>
<div id="flagSelect">
	<ul class="hide"></ul>
	<input type="button" value="(You)" onclick="">
</div>`

const debug = (text) => bantFlagsState.debug_mode && console.log("[BantFlags][Debug] " + text)
const log = (text) => console.log("[BantFlags] " + text)
const toggleFlagButton = (state) => (document.getElementById("append_flag_button").disabled = state === "off" ? true : false)
const isGM4 = typeof GM_setValue === "undefined"
const makeElement = (tag, options) => Object.assign(document.createElement(tag), options)
const flagsApiRoot = "https://flags.plum.moe/"

const monkey = {
  setValue: isGM4 ? GM.setValue : GM_setValue,
  getValue: isGM4 ? GM.getValue : GM_getValue,
  xmlHttpRequest: isGM4 ? GM.xmlHttpRequest : GM_xmlhttpRequest
}

const bantFlagsState = {
  my_flags: monkey.getValue("bantflags", []),
  flags_loaded: false,
  max_flags: 30,
  debug_mode: false
}

const http = {
  get: function (url, callback) {
    monkey.xmlHttpRequest({
      method: "get",
      url: url,
      onload: callback
    })
  },
  post: function (url, data, callback) {
    monkey.xmlHttpRequest({
      method: "post",
      url: url,
      data: data,
      headers: { "Content-Type": "application/json" },
      onload: callback
    })
  }
}

const flagsApi = {
  flags: flagsApiRoot + "api/flags",
  get: flagsApiRoot + "api/get",
  post: flagsApiRoot + "api/post",
  files: "https://raw.githubusercontent.com/Nick80835/bant_flags/main/flags/",
  files_fallback: flagsApiRoot + "flags/"
}

const flagCache = {
  cache: JSON.parse(monkey.getValue("bantflagscache", "{}")),
  changed: false,
  limit: 250,
  addItem: (postID, flags) => {
    while (Object.keys(flagCache.cache).length >= flagCache.limit) {
      debug("Removing item from cache: " + flagCache.cache[Object.keys(flagCache.cache)[0]])
      delete flagCache.cache[Object.keys(flagCache.cache)[0]]
    }

    debug("Adding item to cache: " + postID + " " + flags)
    flagCache.cache[postID] = flags
    flagCache.changed = true
  },
  save: () => {
    if (flagCache.changed == true) {
      debug("Saving cache")
      monkey.setValue("bantflagscache", JSON.stringify(flagCache.cache))
      flagCache.changed = false
    }
  }
}

//
//
// ENTRYPOINT
//
//

window.addEventListener("load", () => {
  ;(async () => {
    if (!location.href.match(/\/thread\//)) await new Promise((r) => setTimeout(r, 500))
    bantFlagsMain()
  })()
})

//
//
// MAIN SCRIPT
//
//

function saveFlags() {
  // it's almost as if I'm trying to use Map.
  bantFlagsState.my_flags = []
  for (const flag of document.querySelectorAll(".bantflags_flag")) {
    bantFlagsState.my_flags.push(flag.title)
  }

  debug(bantFlagsState.my_flags)
  monkey.setValue("bantflags", bantFlagsState.my_flags)
}

/** Add a flag to our selection. */
function setFlag(flag, save) {
  const flagName = flag ? flag : document.querySelector("#flagSelect input").value
  const container = document.getElementById("bantflags_container")

  container.appendChild(
    makeElement("img", {
      title: flagName,
      src: `${flagsApi.files}${flagName}.png`,
      className: "bantflags_flag",
      onclick: function () {
        container.removeChild(this)

        if (bantFlagsState.flags_loaded) {
          toggleFlagButton("on")
        }

        saveFlags()
      }
    })
  )

  if (container.children.length >= bantFlagsState.max_flags) toggleFlagButton("off")

  if (!flag || save === true)
    // We've added a new flag to our selection
    saveFlags()
}

/** Get flag data from server and fill flags form. */
function makeFlagSelect() {
  http.get(flagsApi.flags, function (resp) {
    debug("Loading flags.")

    if (resp.status !== 200) {
      log("Couldn't get flag list from server")
      return
    }

    // This is hacking togther a fake <select> so that images work inside
    // it, thanks shitty browser controls.
    const flagSelect = document.getElementById("flagSelect")
    const flagInput = flagSelect.querySelector("input")
    const flagList = flagSelect.querySelector("ul")

    for (const flag of resp.responseText.split("\n")) {
      flagList.appendChild(
        makeElement("li", {
          innerHTML: "<img src='" + flagsApi.files + flag + ".png' title='" + flag + "'><span>" + flag + "</span>"
        })
      )
    }

    flagSelect.addEventListener("click", (e) => {
      // Maybe we clicked the flag image
      const node = e.target.nodeName === "LI" ? e.target : e.target.parentNode
      if (node.nodeName === "LI") {
        flagInput.value = node.querySelector("span").innerHTML
      }

      flagList.classList.toggle("hide")
    })

    const flagButton = document.getElementById("append_flag_button")
    flagButton.addEventListener("click", () => setFlag())
    flagButton.disabled = false

    document.getElementById("flagLoad").style.display = "none"
    document.querySelector(".flagsForm").style.marginRight = "200px" // flagsForm has position: absolute and is ~200px long.
    flagSelect.style.display = "inline-block"
    bantFlagsState.flags_loaded = true
  })
}

/** Get flags from the database using values in postNrs and pass the response on to onFlagsLoad */
function resolveFlags(post_numbers) {
  let cached_post_numbers = []

  post_numbers = post_numbers.filter((num) => {
    if (flagCache.cache[num]) {
      cached_post_numbers.push(num)
      return false
    }

    return true
  })

  debug("Cache size: " + Object.keys(flagCache.cache).length)
  debug("Cached posts: " + cached_post_numbers)

  // don't need to ask the server for cached post flags
  cached_post_numbers.forEach((post_id) => {
    let cached_flags = flagCache.cache[post_id]
    debug("Resolving cached flags for " + post_id + ": " + cached_flags)
    let flagContainer = document.querySelector(`[id = "pc${post_id}"] .postInfo .nameBlock`)

    cached_flags.forEach((flag) => {
      flagContainer.append(
        makeElement("a", {
          innerHTML: `<img src="${flagsApi.files}${flag}.png" title="${flag}" onerror="console.log('[BantFlags] Falling back on flag: ${flag}'); this.onerror = null; this.src = '${flagsApi.files_fallback}${flag}.png'">`,
          className: "bantFlag",
          target: "_blank"
        })
      )
    })
  })

  http.post(flagsApi.get, JSON.stringify({ post_numbers: post_numbers }), (resp) => {
    if (resp.status !== 200) {
      log("Couldn't load flags, refresh the page. Response code: " + resp.status)
      debug(resp.responseText)
      return
    }

    const json = JSON.parse(resp.responseText)
    debug(`JSON: ${resp.responseText}`)

    Object.keys(json).forEach((post_id) => {
      const flags = json[post_id]

      if (flags.length <= 0) {
        return
      }

      flagCache.addItem(post_id, flags)
      debug(`Resolving flags for >>${post_id}`)
      let flagContainer = document.querySelector(`[id = "pc${post_id}"] .postInfo .nameBlock`)

      for (const flag of flags) {
        flagContainer.append(
          makeElement("a", {
            innerHTML: `<img src="${flagsApi.files}${flag}.png" title="${flag}" onerror="console.log('[BantFlags] Falling back on flag: ${flag}'); this.onerror = null; this.src = '${flagsApi.files_fallback}${flag}.png'">`,
            className: "bantFlag",
            target: "_blank"
          })
        )
      }
    })

    flagCache.save()
  })
}

function bantFlagsMain() {
  document.head.appendChild(
    makeElement("style", {
      innerHTML: flagsStyle
    })
  )

  document.getElementById("delform").appendChild(
    makeElement("div", {
      className: "flagsForm",
      innerHTML: flagsForm
    })
  )

  bantFlagsState.my_flags = typeof bantFlagsState.my_flags === "undefined" ? [] : bantFlagsState.my_flags

  for (const flag of bantFlagsState.my_flags) {
    debug(flag)
    setFlag(flag)
  }

  document.getElementById("flagLoad").addEventListener("click", makeFlagSelect, { once: true })

  const post_numbers = []
  for (const post of document.querySelectorAll(".postContainer")) {
    post_numbers.push(parseInt(post.id.substring(2)))
  }

  // finish up with flags
  resolveFlags(post_numbers)
}

document.addEventListener("dblclick", (e) => e.target.parentNode.classList.contains("bantFlag") && setFlag(e.target.title, true))

const doPostFlags = (post_number) => {
  if (monkey.getValue("bantflagsenabled", true)) {
    debug(
      JSON.stringify({
        post_number: post_number,
        flags: bantFlagsState.my_flags
      })
    )
    http.post(
      flagsApi.post,
      JSON.stringify({
        post_number: parseInt(post_number),
        flags: bantFlagsState.my_flags
      }),
      (resp) => debug(resp.responseText)
    )
  }
}

const e_detail = (e) => e.detail || e.wrappedJSObject.detail
document.addEventListener("QRPostSuccessful", (e) => doPostFlags(e_detail(e).postID))
document.addEventListener("4chanQRPostSuccess", (e) => doPostFlags(e_detail(e).postId))

document.addEventListener("ThreadUpdate", (e) => {
  const d = e_detail(e)
  if (d[404]) {
    return
  }

  debug(d)
  resolveFlags(d.newPosts.map((post) => parseInt(post.split(".")[1])))
})

document.addEventListener("4chanThreadUpdated", (e) => {
  const d = e_detail(e)
  if (d.count <= 0) {
    return
  }

  // Get the added posts in reverse order, take post numbers from ID
  const posts = document.querySelectorAll(".postContainer")
  const post_numbers = []
  for (let i = 0; i < d.count; i++) {
    post_numbers.push(parseInt(posts[posts.length - 1 - i].id.substr(2)))
  }

  resolveFlags(post_numbers)
})

//
//
// TOGGLE ARRAY
//
//

function updateMenu() {
  GM_unregisterMenuCommand("Enabled")
  GM_unregisterMenuCommand("Disabled")

  switch (monkey.getValue("bantflagsenabled", true)) {
    case true: {
      GM_registerMenuCommand("Enabled", () => {
        monkey.setValue("bantflagsenabled", false)
        updateMenu()
      })
      break
    }
    case false: {
      GM_registerMenuCommand("Disabled", () => {
        monkey.setValue("bantflagsenabled", true)
        updateMenu()
      })
      break
    }
  }
}

updateMenu()
