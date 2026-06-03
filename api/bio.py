from __future__ import annotations

import math
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from scipy import stats
from scipy.cluster.hierarchy import linkage, leaves_list
from sklearn.cross_decomposition import PLSRegression
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression, Lasso, Ridge
from sklearn.metrics import roc_curve, auc
from sklearn.preprocessing import StandardScaler
from sqlalchemy.orm import Session
import statsmodels.api as sm
from statsmodels.formula.api import ols
from lifelines import KaplanMeierFitter, CoxPHFitter

from schemas.bio import AnalyzeRequest
from utils.auth import get_optional_admin, check_permission
from database import get_db
from models import AdminUser
from api.dependencies import verify_service_access

router = APIRouter(prefix="/api/bio", tags=["bio"])


@router.post("/analyze")
async def analyze_bio_data(request: AnalyzeRequest, db: Session = Depends(get_db), current_user: Optional[AdminUser] = Depends(get_optional_admin)):
    if not current_user:
        await verify_service_access(db, request.token, "bio")
    else:
        check_permission(current_user, "bio")

    try:
        df = pd.DataFrame(request.data)
        config = request.config
        analysis_type = request.type

        for col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='ignore')

        if analysis_type == 'pca':
            features = config.get('features', [])
            if len(features) < 2: raise HTTPException(status_code=400, detail="PCA 分析至少需要选择 2 个特征列")

            # Check if features exist in dataframe
            missing_cols = [col for col in features if col not in df.columns]
            if missing_cols:
                raise HTTPException(status_code=400, detail=f"数据中缺少必要的列: {', '.join(missing_cols)}")

            X = df[features].dropna()
            if X.empty:
                raise HTTPException(status_code=400, detail="所选特征列中没有有效的数值数据")

            X_scaled = StandardScaler().fit_transform(X)
            pca = PCA(n_components=2)
            pcs = pca.fit_transform(X_scaled)
            pca_df = pd.DataFrame(pcs, columns=['PC1', 'PC2'])

            color_col = config.get('colorColumn')
            if color_col and color_col in df.columns:
                pca_df['label'] = df.loc[X.index, color_col].values
            else:
                pca_df['label'] = 'Sample'

            return {"pca_data": pca_df.to_dict(orient="records"), "explained_variance": pca.explained_variance_ratio_.tolist()}

        elif analysis_type in ['ttest', 'wilcox']:
            group_col, val_col = config.get('groupColumn'), config.get('valueColumn')
            if not group_col or not val_col: raise HTTPException(status_code=400, detail="请确保已选择分组列和数值列")
            if group_col not in df.columns or val_col not in df.columns:
                raise HTTPException(status_code=400, detail="所选的列名在当前数据中不存在")

            groups = df[group_col].unique()
            if len(groups) != 2: raise HTTPException(status_code=400, detail=f"该分析需要 2 个分组，但当前选择了 {len(groups)} 个分组")

            d1 = df[df[group_col] == groups[0]][val_col].dropna()
            d2 = df[df[group_col] == groups[1]][val_col].dropna()

            if d1.empty or d2.empty:
                raise HTTPException(status_code=400, detail="其中一个分组中没有有效的数值数据")

            res = stats.ttest_ind(d1, d2) if analysis_type == 'ttest' else stats.mannwhitneyu(d1, d2)
            return {"plot_data": [{"y": d1.tolist(), "type": "box", "name": str(groups[0])}, {"y": d2.tolist(), "type": "box", "name": str(groups[1])}], "stats": {"statistic": float(res.statistic), "p_value": float(res.pvalue)}}

        elif analysis_type == 'anova':
            group_col, val_col = config.get('groupColumn'), config.get('valueColumn')
            df_clean = df[[group_col, val_col]].dropna()
            df_clean.columns = ['group', 'value']
            model = ols('value ~ C(group)', data=df_clean).fit()
            anova_table = sm.stats.anova_lm(model, typ=2)
            plot_data = [{"y": df[df[group_col] == g][val_col].dropna().tolist(), "type": "box", "name": str(g)} for g in df[group_col].unique()]
            cleaned_stats = {}
            for col_name, col_data in anova_table.to_dict().items():
                cleaned_stats[col_name] = {k: (None if not isinstance(v, (int, float)) else (None if math.isnan(v) or math.isinf(v) else v)) for k, v in col_data.items()}
            return {"plot_data": plot_data, "stats": cleaned_stats}

        elif analysis_type in ['chisq', 'fisher']:
            col_a, col_b = config.get('columnA'), config.get('columnB')
            contingency = pd.crosstab(df[col_a], df[col_b])
            if analysis_type == 'chisq':
                chi2, p, dof, expected = stats.chi2_contingency(contingency)
                res_stats = {"chi2": chi2, "p_value": p, "dof": dof}
            else:
                if contingency.shape == (2, 2):
                    oddsratio, p = stats.fisher_exact(contingency)
                    res_stats = {"oddsratio": oddsratio, "p_value": p}
                else: raise HTTPException(status_code=400, detail="Fisher exact test requires a 2x2 table")
            plot_data = [{"x": contingency.index.astype(str).tolist(), "y": contingency[col].tolist(), "type": "bar", "name": str(col)} for col in contingency.columns]
            return {"plot_data": plot_data, "plot_layout": {"barmode": "group"}, "stats": res_stats}

        elif analysis_type == 'linreg':
            y_col, x_cols = config.get('yColumn'), config.get('xColumns', [])
            X = df[x_cols].dropna()
            y = df.loc[X.index, y_col]
            X = sm.add_constant(X)
            model = sm.OLS(y, X).fit()
            plot_data = []
            if len(x_cols) == 1:
                x_val, y_val = df[x_cols[0]].dropna(), df.loc[df[x_cols[0]].dropna().index, y_col]
                plot_data = [{"x": x_val.tolist(), "y": y_val.tolist(), "mode": "markers", "name": "Data"}, {"x": [x_val.min(), x_val.max()], "y": model.predict(sm.add_constant([x_val.min(), x_val.max()])).tolist(), "mode": "lines", "name": "Fit"}]
            return {"plot_data": plot_data, "stats": model.summary().as_html()}

        elif analysis_type == 'corr':
            features, method = config.get('features', []), config.get('method', 'pearson')
            corr_matrix = df[features].corr(method=method)
            return {"plot_data": [{"z": corr_matrix.values.tolist(), "x": features, "y": features, "type": "heatmap", "colorscale": "RdBu", "zmin": -1, "zmax": 1}], "stats": corr_matrix.to_dict()}

        elif analysis_type == 'km':
            time_col, event_col, group_col = config.get('timeColumn'), config.get('eventColumn'), config.get('groupColumn')
            kmf = KaplanMeierFitter()
            plot_data = []
            if group_col and group_col in df.columns:
                for name, grouped_df in df.groupby(group_col):
                    kmf.fit(grouped_df[time_col], grouped_df[event_col], label=str(name))
                    plot_data.append({"x": kmf.survival_function_.index.tolist(), "y": kmf.survival_function_.iloc[:, 0].tolist(), "mode": "lines", "shape": "hv", "name": str(name)})
            else:
                kmf.fit(df[time_col], df[event_col])
                plot_data.append({"x": kmf.survival_function_.index.tolist(), "y": kmf.survival_function_.iloc[:, 0].tolist(), "mode": "lines", "shape": "hv", "name": "Survival"})
            return {"plot_data": plot_data, "plot_layout": {"xaxis": {"title": "Time"}, "yaxis": {"title": "Survival Probability"}}}

        elif analysis_type == 'roc':
            label_col, score_col = config.get('labelColumn'), config.get('scoreColumn')
            y_true = df[label_col].dropna()
            y_score = df.loc[y_true.index, score_col]
            fpr, tpr, thresholds = roc_curve(y_true, y_score)
            roc_auc = auc(fpr, tpr)
            return {"plot_data": [{"x": fpr.tolist(), "y": tpr.tolist(), "mode": "lines", "name": f"ROC (AUC = {roc_auc:.2f})"}, {"x": [0, 1], "y": [0, 1], "mode": "lines", "line": {"dash": "dash"}, "name": "Random"}], "plot_layout": {"xaxis": {"title": "FPR"}, "yaxis": {"title": "TPR"}}, "stats": {"auc": roc_auc}}

        elif analysis_type == 'logreg':
            y_col, x_cols = config.get('yColumn'), config.get('xColumns', [])
            X = df[x_cols].dropna()
            y = df.loc[X.index, y_col]
            model = LogisticRegression().fit(X, y)

            # Simple 1D visualization if only 1 feature
            plot_data = []
            if len(x_cols) == 1:
                x_val = X.iloc[:, 0]
                plot_data.append({"x": x_val.tolist(), "y": y.tolist(), "mode": "markers", "name": "Data"})
                x_range = np.linspace(x_val.min(), x_val.max(), 100).reshape(-1, 1)
                y_prob = model.predict_proba(x_range)[:, 1]
                plot_data.append({"x": x_range.flatten().tolist(), "y": y_prob.tolist(), "mode": "lines", "name": "Probability"})

            return {
                "plot_data": plot_data,
                "stats": {
                    "coefficients": model.coef_.tolist(),
                    "intercept": model.intercept_.tolist(),
                    "classes": model.classes_.tolist()
                }
            }

        elif analysis_type == 'lasso':
            y_col, x_cols = config.get('yColumn'), config.get('xColumns', [])
            alpha = float(config.get('alpha', 1.0))
            model_type = config.get('modelType', 'lasso')
            X = df[x_cols].dropna()
            y = df.loc[X.index, y_col]

            if model_type == 'ridge':
                model = Ridge(alpha=alpha).fit(X, y)
            else:
                model = Lasso(alpha=alpha).fit(X, y)

            return {
                "plot_data": [{"x": x_cols, "y": model.coef_.tolist(), "type": "bar", "name": "Coefficients"}],
                "stats": {"intercept": float(model.intercept_), "coef": dict(zip(x_cols, model.coef_.tolist()))}
            }

        elif analysis_type == 'cox':
            time_col, event_col, group_col = config.get('timeColumn'), config.get('eventColumn'), config.get('groupColumn')
            cols = [time_col, event_col]
            if group_col: cols.append(group_col)

            df_cox = df[cols].dropna()
            cph = CoxPHFitter()
            cph.fit(df_cox, duration_col=time_col, event_col=event_col)

            return {
                "stats": cph.summary.to_dict(),
                "plot_data": [] # Summary table is more important for Cox
            }

        elif analysis_type == 'logrank':
            from lifelines.statistics import logrank_test
            time_col, event_col, group_col = config.get('timeColumn'), config.get('eventColumn'), config.get('groupColumn')
            groups = df[group_col].unique()
            if len(groups) != 2: raise HTTPException(status_code=400, detail="Log-rank needs 2 groups")

            d1 = df[df[group_col] == groups[0]]
            d2 = df[df[group_col] == groups[1]]
            res = logrank_test(d1[time_col], d2[time_col], event_observed_A=d1[event_col], event_observed_B=d2[event_col])

            return {"stats": {"test_statistic": float(res.test_statistic), "p_value": float(res.p_value)}}

        elif analysis_type == 'plsda':
            features, color_col = config.get('features', []), config.get('colorColumn')
            X = df[features].dropna()
            # PLS-DA uses dummy variables for Y
            y = pd.get_dummies(df.loc[X.index, color_col])

            pls = PLSRegression(n_components=2)
            pls.fit(X, y)

            # Scores (X_scores_) are the coordinates in the new space
            x_scores = pls.x_scores_
            pca_df = pd.DataFrame(x_scores, columns=['Comp1', 'PC2']) # Use PC2 label for simplicity in frontend
            pca_df['label'] = df.loc[X.index, color_col].values

            return {
                "pca_data": pca_df.to_dict(orient="records"), # Reuse pca_data structure
                "stats": {"x_weights": pls.x_weights_.tolist(), "y_weights": pls.y_weights_.tolist()}
            }

        elif analysis_type in ['heatmap', 'cluster_heatmap']:
            features = config.get('features', [])
            label_col = config.get('labelColumn')
            X = df[features].dropna()

            if analysis_type == 'cluster_heatmap':
                method = config.get('clusterMethod', 'average')
                # Cluster rows
                row_linkage = linkage(X, method=method)
                row_order = leaves_list(row_linkage)
                # Cluster columns
                col_linkage = linkage(X.T, method=method)
                col_order = leaves_list(col_linkage)

                X_reordered = X.iloc[row_order, col_order]
                y_labels = df.loc[X.index[row_order], label_col].tolist() if label_col and label_col in df.columns else None
                x_labels = [features[i] for i in col_order]
            else:
                X_reordered = X
                y_labels = df.loc[X.index, label_col].tolist() if label_col and label_col in df.columns else None
                x_labels = features

            return {
                "plot_data": [{
                    "z": X_reordered.values.tolist(),
                    "x": x_labels,
                    "y": y_labels,
                    "type": "heatmap",
                    "colorscale": "Viridis"
                }],
                "stats": {"shape": X_reordered.shape}
            }

        elif analysis_type == 'circular_heatmap':
            features = config.get('features', [])
            label_col = config.get('labelColumn')
            X = df[features].dropna()

            # For circular heatmap, we can use barpolar for each "ring"
            # Or a single heatmap if we can map it to polar, but barpolar is easier for "cells"
            n_rows = len(X)
            n_cols = len(features)

            plot_data = []
            theta = np.linspace(0, 360, n_rows, endpoint=False)
            width = 360 / n_rows

            for i, col in enumerate(features):
                values = X[col].tolist()
                plot_data.append({
                    "type": "barpolar",
                    "r": [1] * n_rows, # Each ring has same "thickness"
                    "base": i, # Inner radius for this ring
                    "theta": theta.tolist(),
                    "width": width,
                    "marker": {
                        "color": values,
                        "colorscale": "Viridis",
                        "showscale": i == 0
                    },
                    "name": col,
                    "hoverinfo": "text",
                    "text": [f"Row: {df.loc[X.index[j], label_col] if label_col else j}, Col: {col}, Value: {v}" for j, v in enumerate(values)]
                })

            return {
                "plot_data": plot_data,
                "plot_layout": {
                    "polar": {
                        "radialaxis": {"visible": False},
                        "angularaxis": {"visible": False}
                    },
                    "showlegend": True
                }
            }

        else: raise HTTPException(status_code=400, detail=f"Analysis type {analysis_type} not implemented")
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
