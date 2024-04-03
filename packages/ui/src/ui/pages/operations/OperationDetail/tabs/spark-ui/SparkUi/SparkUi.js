import React, {Component} from 'react';
import {connect, useSelector} from 'react-redux';
import PropTypes from 'prop-types';
import cn from 'bem-cn-lite';

import {showEditPoolsWeightsModal} from '../../../../../../store/actions/operations';

import {useRumMeasureStop} from '../../../../../../rum/RumUiContext';
import {RumMeasureTypes} from '../../../../../../rum/rum-measure-types';
import {isFinalLoadingStatus} from '../../../../../../utils/utils';
import {
    getOperationAlertEventsItems,
    getOperationDetailsLoadingStatus,
} from '../../../../../../store/selectors/operations/operation';
import {useAppRumMeasureStart} from '../../../../../../rum/rum-app-measures';

import {getUISizes} from '../../../../../../store/selectors/global';

import {operationProps, runtimeProps, eventsProps, resourcesProps, intermediateResourcesProps, } from '../../details/Runtime/Runtime';

import {specificationProps} from '../../details/Specification/Specification';


import './SparkUi.scss';

const block = cn('spark-ui');

class SparkUi extends Component {
    static propTypes = {
        error: PropTypes.object,
        operation: operationProps.isRequired,
        cluster: PropTypes.string.isRequired,
        result: PropTypes.shape({
            error: PropTypes.object.isRequired,
        }),
        runtime: runtimeProps,
    };

    handleEditClick = () => {
        const {operation, showEditPoolsWeightsModal} = this.props;
        showEditPoolsWeightsModal(operation);
    };

    renderDescription() {
        const {description, collapsibleSize} = this.props.operation;

        return (
            JSON.stringify(description)
        );
    }

    render() {
        const {description} = this.props.operation;
        const src = `/spark-ui-proxy/${encodeURIComponent(description["Web UI"])}/`;
        return (
            <div className={block()}>
                {src}
                {this.renderDescription()}
                <a href={src} target='_blank'>Open in new window</a>
                <iframe src={src} className={block('iframe')}></iframe>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const {operations, global} = state;

    const {cluster} = global;
    const {operation} = operations.detail;

    return {
        cluster,
        operation,
        ...operations.detail.details,
        collapsibleSize: getUISizes().collapsibleSize,
        alertEvents: getOperationAlertEventsItems(state),
    };
};

const mapDispatchToProps = {
    showEditPoolsWeightsModal,
};

const DetailsConnected = connect(mapStateToProps, mapDispatchToProps)(SparkUi);

export default function DetailsWithRum() {
    const loadState = useSelector(getOperationDetailsLoadingStatus);

    useAppRumMeasureStart({
        type: RumMeasureTypes.OPERATION_TAB_DETAILS,
        additionalStartType: RumMeasureTypes.OPERATION,
        startDeps: [loadState],
        allowStart: ([loadState]) => {
            return !isFinalLoadingStatus(loadState);
        },
    });

    useRumMeasureStop({
        type: RumMeasureTypes.OPERATION_TAB_DETAILS,
        stopDeps: [loadState],
        allowStop: ([loadState]) => {
            return isFinalLoadingStatus(loadState);
        },
    });

    return <DetailsConnected />;
}
