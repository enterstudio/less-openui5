// Copyright 2017 SAP SE.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http: //www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
// either express or implied. See the License for the specific
// language governing permissions and limitations under the License.

'use strict';

// Regular expression to match type of property in order to check whether
// it possibly contains color values.
var rProperties = /(color|background|border|text|outline)(?!\-(width|radius|offset|style|align|overflow|transform))(\-(color|shadow|image))?/;

function selectorEquals(s1, s2) {

	// Make sure there is the same number of select parts
	if (s1.length !== s2.length) {
		return false;
	}

	// Check if all the parts are the same strings
	for (var i = 0; i < s1.length; i++) {
		if (s1[i] !== s2[i]) {
			return false;
		}
	}

	return true;
}

function Diffing(oBase, oCompare) {
	this.oBase = oBase;
	this.oCompare = oCompare;

	this.oDiff = {
		type: "stylesheet",
		stylesheet: {
			rules: []
		},
	};

	this.oStack = {
		type: "stylesheet",
		stylesheet: {
			rules: []
		},
	};
}

Diffing.prototype.diffRules = function(oBaseRules, oCompareRules) {
	var aDiffRules = [];
	var iBaseNode, iCompareNode;

	for (iBaseNode = 0, iCompareNode = 0; iBaseNode < oBaseRules.length; iBaseNode++, iCompareNode++) {
		var oBaseNode = oBaseRules[iBaseNode];
		var oCompareNode = oCompareRules[iCompareNode];
		var oDiffNode = null;

		// Add all different compare nodes to stack and check for next one
		while (oBaseNode.type !== oCompareNode.type) {
			this.oStack.stylesheet.rules.push(oCompareNode);
			iCompareNode++;
			oCompareNode = oCompareRules[iCompareNode];
		}

		if (oBaseNode.type === "comment") {
			var sBaseComment = oBaseNode.comment;
			var sCompareComment = oCompareNode.comment;

			if (sBaseComment !== sCompareComment) {
				oDiffNode = oCompareNode;
			}
		}

		if (oBaseNode.type === "rule") {

			// Add all rules with different selector to stack and check for next one
			while (!selectorEquals(oBaseNode.selectors, oCompareNode.selectors)) {
				this.oStack.stylesheet.rules.push(oCompareNode);
				iCompareNode++;
				oCompareNode = oCompareRules[iCompareNode];
			}

			var aBaseDeclarations = oBaseNode.declarations;
			var aCompareDeclarations = oCompareNode.declarations;
			for (var j = 0; j < aBaseDeclarations.length; j++) {
				var oBaseDeclaration = aBaseDeclarations[j];
				var oCompareDeclaration = aCompareDeclarations[j];

				if (oBaseDeclaration.type === "declaration") {

					// TODO: Also check for different node and add to stack???
					if (oBaseDeclaration.type === oCompareDeclaration.type) {

						if (oBaseDeclaration.property === oCompareDeclaration.property) {

							// Always add color properties to diff to prevent unexpected CSS overrides
							// due to selectors with more importance
							if (oBaseDeclaration.value !== oCompareDeclaration.value
									|| oCompareDeclaration.property.match(rProperties)) {

								// Add compared rule to diff
								if (!oDiffNode) {
									oDiffNode = oCompareNode;
									oDiffNode.declarations = [];
								}
								oDiffNode.declarations.push(oCompareDeclaration);
							}

						}
					}
				}
			}

		} else if (oBaseNode.type === "media") {

			var aMediaDiffRules = this.diffRules(oBaseNode.rules, oCompareNode.rules);

			if (aMediaDiffRules.length > 0) {
				oDiffNode = oCompareNode;
				oDiffNode.rules = aMediaDiffRules;
			}

		}

		if (oDiffNode) {
			aDiffRules.push(oDiffNode);
		}

	}

	// Add all leftover compare nodes to stack
	for (; iCompareNode < oCompareRules.length; iCompareNode++) {
		this.oStack.stylesheet.rules.push(oCompareRules[iCompareNode]);
	}

	return aDiffRules;
};

Diffing.prototype.run = function() {
	var oBaseRules = this.oBase.stylesheet.rules;
	var oCompareRules = this.oCompare.stylesheet.rules;

	this.oDiff.stylesheet.rules = this.diffRules(oBaseRules, oCompareRules);

	return {
		diff: this.oDiff,
		stack: this.oStack
	};
};


module.exports = function diff(oBase, oCompare) {
	return new Diffing(oBase, oCompare).run();
};
